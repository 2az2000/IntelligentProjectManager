import { prisma, type Db } from '../../../shared/db/prisma';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import type { ProjectRole } from '../../projects';
import {
  probabilityWithin,
  runMonteCarlo,
} from '../domain/monte-carlo';
import { computeRiskScores, type RiskView } from '../domain/risk-score';
import { calculateCriticalPath } from '../domain/critical-path';
import { loadScheduleInput } from './scheduling.service';
import { buildSchedule } from './schedule';

/** What analytics needs from the projects module (same contract as scheduling). */
export interface ProjectAccess {
  assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole>;
}

export interface ForecastTaskView {
  taskId: number;
  /** Share of runs where this task was on the critical chain (0..1). */
  criticality: number;
}

export interface ForecastResult {
  runs: number;
  /** Percentile finishing effort in working hours. */
  p50Hours: number;
  p85Hours: number;
  p95Hours: number;
  /** Calendar dates projected from the project anchor (startDate or now). */
  p50Date: string;
  p85Date: string;
  p95Date: string;
  /** Chance of finishing before the project's endDate, null when no deadline set. */
  deadlineProbability: number | null;
  tasks: ForecastTaskView[];
}

export interface RiskResult {
  tasks: (RiskView & { title: string; status: string })[];
  generatedAt: string;
}

export interface BurndownPoint {
  /** ISO date of the snapshot. */
  date: string;
  /** Remaining open top-level tasks at end of this day. */
  remaining: number;
  /** Ideal linear burn from total to zero over the window. */
  ideal: number;
}

export interface BurndownResult {
  from: string;
  to: string;
  total: number;
  points: BurndownPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class AnalyticsService {
  constructor(
    private readonly db: Db = prisma,
    private readonly access: ProjectAccess,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /** Monte Carlo percentile forecast — reuses the exact CPM engine from phase 4. */
  async getForecast(userId: number, projectId: number): Promise<ForecastResult> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const { tasks, deps } = await loadScheduleInput(this.db, projectId);

    const mc = runMonteCarlo(
      tasks.map((t) => ({ id: t.id, estimateHours: t.estimateHours, status: t.status })),
      deps,
      (nodes, edges) => calculateCriticalPath(nodes, edges),
      { runs: 2000 },
    );

    const project = await this.db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { startDate: true, endDate: true },
    });
    const now = this.clock();
    const anchor =
      project?.startDate && project.startDate > now ? project.startDate : now;

    const toIso = (hours: number) =>
      // Calendar projection ignoring holidays here — percentiles are estimates, and the
      // working-hour roll uses the same weekend rule as the deterministic schedule.
      new Date(anchor.getTime() + hours * 24 * (5 / 7) * DAY_MS).toISOString();

    const deadlineHours =
      project?.endDate
        ? (project.endDate.getTime() - anchor.getTime()) / DAY_MS / (5 / 7)
        : null;

    return {
      runs: mc.runs,
      p50Hours: mc.p50,
      p85Hours: mc.p85,
      p95Hours: mc.p95,
      p50Date: toIso(mc.p50),
      p85Date: toIso(mc.p85),
      p95Date: toIso(mc.p95),
      deadlineProbability:
        deadlineHours !== null && deadlineHours > 0
          ? probabilityWithin(mc.samples, deadlineHours)
          : null,
      tasks: [...mc.criticality.entries()]
        .map(([taskId, criticality]) => ({ taskId, criticality }))
        .sort((a, b) => b.criticality - a.criticality),
    };
  }

  /** Risk-sorted task list with explainable reasons (§3 risk score). */
  async getRisks(userId: number, projectId: number): Promise<RiskResult> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const now = this.clock();
    const [tasks, scheduleInput] = await Promise.all([
      this.db.task.findMany({
        where: { projectId, deletedAt: null, parentId: null },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          estimateHours: true,
          assigneeId: true,
          updatedAt: true,
        },
      }),
      loadScheduleInput(this.db, projectId),
    ]);

    // Rebuild the deterministic schedule once to get slack/critical per task.
    const schedule = buildSchedule(scheduleInput.tasks, scheduleInput.deps, new Set());
    const timingById = new Map(schedule.tasks.map((t) => [t.id, t]));

    // Per-assignee open estimate hours for the over-allocation signal.
    const openByAssignee = new Map<number, number>();
    for (const t of tasks) {
      if (t.status === 'DONE' || t.assigneeId === null) continue;
      openByAssignee.set(t.assigneeId, (openByAssignee.get(t.assigneeId) ?? 0) + (t.estimateHours ?? 0));
    }
    const capacities = new Map<number, number | null>();
    const memberRows = await this.db.projectMember.findMany({
      where: { projectId },
      select: { userId: true, capacityHoursPerWeek: true },
    });
    for (const m of memberRows) capacities.set(m.userId, m.capacityHoursPerWeek);

    const riskTasks = tasks.map((t) => {
      const scheduled = timingById.get(t.id);
      const daysSinceUpdate = Math.floor((now.getTime() - t.updatedAt.getTime()) / DAY_MS);
      return {
        id: t.id,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
        estimateHours: t.estimateHours,
        slack: scheduled?.slack ?? null,
        isCritical: scheduled?.isCritical ?? false,
        daysSinceUpdate,
        assigneeOpenHours: t.assigneeId !== null ? (openByAssignee.get(t.assigneeId) ?? 0) : null,
        assigneeCapacityHours:
          t.assigneeId !== null ? (capacities.get(t.assigneeId) ?? null) : null,
        title: t.title,
      };
    });

    const scored = computeRiskScores(riskTasks, now);
    const metaById = new Map(riskTasks.map((t) => [t.id, t]));
    return {
      tasks: scored.map((r) => ({
        ...r,
        title: metaById.get(r.taskId)!.title,
        status: metaById.get(r.taskId)!.status,
      })),
      generatedAt: now.toISOString(),
    };
  }

  /** Burndown of open top-level tasks over a window, with an ideal line. */
  async getBurndown(
    userId: number,
    projectId: number,
    fromInput?: string,
    toInput?: string,
  ): Promise<BurndownResult> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const now = this.clock();
    const project = await this.db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { startDate: true, createdAt: true },
    });
    if (!project) throw new NotFoundError('PROJECT_NOT_FOUND', 'Project not found');

    const defaultFrom = project.startDate ?? project.createdAt;
    const from = fromInput ? new Date(fromInput) : defaultFrom;
    const to = toInput ? new Date(toInput) : now;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
      throw new ValidationError(null, 'Invalid from/to range');
    }

    const tasks = await this.db.task.findMany({
      where: { projectId, deletedAt: null, parentId: null },
      select: { createdAt: true, completedAt: true },
    });
    const total = tasks.length;
    const days = Math.min(120, Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS)));

    const points: BurndownPoint[] = [];
    for (let d = 0; d <= days; d++) {
      const dayEnd = new Date(from.getTime() + d * DAY_MS);
      if (dayEnd > to) break;
      const opened = tasks.filter((t) => t.createdAt.getTime() <= dayEnd.getTime()).length;
      const done = tasks.filter(
        (t) => t.completedAt !== null && t.completedAt.getTime() <= dayEnd.getTime(),
      ).length;
      const remaining = opened - done;
      const ideal = total * (1 - d / days);
      points.push({ date: dayEnd.toISOString(), remaining, ideal });
    }

    return { from: from.toISOString(), to: to.toISOString(), total, points };
  }
}
