import {
  MAX_BASELINES_PER_PROJECT,
  type BaselineSummary,
  type BaselineTaskAction,
  type BaselineTaskChange,
  type BaselineVariance,
} from '@managesys/contracts';
import { env } from '../../../config/env';
import { prisma, type Db } from '../../../shared/db/prisma';
import { ConflictError, NotFoundError } from '../../../shared/errors';
import type { ProjectRole } from '../../projects';
import { parseWeekend } from '../domain/work-calendar';
import { buildSchedule } from './schedule';
import { loadScheduleInput } from './scheduling.service';
import type { ProjectAccess } from './scheduling.service';

const projectNotFound = () => new NotFoundError('PROJECT_NOT_FOUND', 'Project not found');
const baselineNotFound = () => new NotFoundError('BASELINE_NOT_FOUND', 'Baseline not found');

const round = (hours: number) => Math.round(hours * 100) / 100;

interface BaselineRow {
  id: number;
  projectId: number;
  name: string;
  createdAt: Date;
  taskCount: number;
  projectDurationHours: number;
  createdBy: { id: number; name: string; avatarUrl: string | null };
}

const toSummary = (row: BaselineRow): BaselineSummary => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  createdAt: row.createdAt.toISOString(),
  createdBy: row.createdBy,
  taskCount: row.taskCount,
  projectDurationHours: row.projectDurationHours,
});

/** Order the diff so the conversation starts with what actually moved. */
const ACTION_ORDER: Record<BaselineTaskAction, number> = {
  moved: 0,
  added: 1,
  removed: 2,
  onTrack: 3,
};

/**
 * §2.2 — a baseline is the CPM plan frozen in working hours. The schedule itself is derived on
 * every read, so the only durable comparison is "where each task sat on the axis when captured".
 */
export class BaselineService {
  constructor(
    private readonly db: Db = prisma,
    private readonly access: ProjectAccess,
    /** JS getDay() weekend values — same source as the schedule. */
    private readonly weekend: Set<number> = parseWeekend(env.WORKING_WEEKEND),
  ) {}

  private async assertRole(projectId: number, userId: number, role: ProjectRole): Promise<void> {
    const live = await this.db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { id: true },
    });
    if (!live) throw projectNotFound();
    await this.access.assertRole(projectId, userId, role);
  }

  /** Captures the current plan. MEMBER+ — a snapshot is a deliberate project act. */
  async create(userId: number, projectId: number, name?: string): Promise<BaselineSummary> {
    await this.assertRole(projectId, userId, 'MEMBER');

    const existing = await this.db.scheduleBaseline.count({ where: { projectId } });
    if (existing >= MAX_BASELINES_PER_PROJECT) {
      throw new ConflictError(
        'BASELINE_LIMIT_REACHED',
        `A project keeps at most ${MAX_BASELINES_PER_PROJECT} baselines; delete an old one first`,
      );
    }

    const { tasks, deps } = await loadScheduleInput(this.db, projectId);
    const schedule = buildSchedule(tasks, deps, this.weekend);

    const row = await this.db.scheduleBaseline.create({
      data: {
        projectId,
        name: name?.trim() || `Baseline ${existing + 1}`,
        createdById: userId,
        projectDurationHours: schedule.projectDurationHours,
        taskCount: schedule.tasks.length,
        items: {
          create: schedule.tasks.map((task) => ({
            taskId: task.id,
            title: task.title,
            startHours: task.earliestStart,
            finishHours: task.earliestFinish,
            estimateHours: task.estimateHours,
          })),
        },
      },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return toSummary(row);
  }

  /** Newest first — the one people compare against is almost always the last capture. */
  async list(userId: number, projectId: number): Promise<BaselineSummary[]> {
    await this.assertRole(projectId, userId, 'VIEWER');
    const rows = await this.db.scheduleBaseline.findMany({
      where: { projectId },
      include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(toSummary);
  }

  /** Per-task diff between the stored plan and the schedule computed right now. */
  async variance(
    userId: number,
    projectId: number,
    baselineId: number,
  ): Promise<BaselineVariance> {
    await this.assertRole(projectId, userId, 'VIEWER');

    const baseline = await this.db.scheduleBaseline.findFirst({
      where: { id: baselineId, projectId },
      include: {
        items: true,
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    if (!baseline) throw baselineNotFound();

    const { tasks, deps } = await loadScheduleInput(this.db, projectId);
    const schedule = buildSchedule(tasks, deps, this.weekend);
    const planned = new Map(baseline.items.map((item) => [item.taskId, item]));

    const changes: BaselineTaskChange[] = [];
    const counts: Record<BaselineTaskAction, number> = { added: 0, removed: 0, moved: 0, onTrack: 0 };

    for (const task of schedule.tasks) {
      const item = planned.get(task.id);
      if (!item) {
        counts.added += 1;
        changes.push({
          taskId: task.id,
          title: task.title,
          action: 'added',
          baselineStartHours: null,
          baselineFinishHours: null,
          currentStartHours: task.earliestStart,
          currentFinishHours: task.earliestFinish,
          driftHours: null,
        });
        continue;
      }
      planned.delete(task.id);

      // Both sides need a position on the axis; an unestimated task has none to compare.
      const driftHours =
        item.startHours !== null && task.earliestStart !== null
          ? round(task.earliestStart - item.startHours)
          : 0;
      const action: BaselineTaskAction = driftHours === 0 ? 'onTrack' : 'moved';
      counts[action] += 1;
      changes.push({
        taskId: task.id,
        title: task.title,
        action,
        baselineStartHours: item.startHours,
        baselineFinishHours: item.finishHours,
        currentStartHours: task.earliestStart,
        currentFinishHours: task.earliestFinish,
        driftHours: item.startHours === null || task.earliestStart === null ? null : driftHours,
      });
    }

    // Whatever is left was planned once and is gone now (deleted, unestimated, or made a subtask).
    for (const item of planned.values()) {
      counts.removed += 1;
      changes.push({
        taskId: item.taskId,
        title: item.title,
        action: 'removed',
        baselineStartHours: item.startHours,
        baselineFinishHours: item.finishHours,
        currentStartHours: null,
        currentFinishHours: null,
        driftHours: null,
      });
    }

    changes.sort(
      (a, b) =>
        ACTION_ORDER[a.action] - ACTION_ORDER[b.action] ||
        Math.abs(b.driftHours ?? 0) - Math.abs(a.driftHours ?? 0) ||
        a.title.localeCompare(b.title),
    );

    return {
      baseline: toSummary(baseline),
      currentDurationHours: schedule.projectDurationHours,
      durationDriftHours: round(schedule.projectDurationHours - baseline.projectDurationHours),
      counts,
      totalDriftHours: round(
        changes.reduce((sum, change) => sum + Math.max(0, change.driftHours ?? 0), 0),
      ),
      tasks: changes,
    };
  }
}
