import { prisma, type Db } from '../../../shared/db/prisma';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import type { ProjectRole } from '../../projects';

/** What time tracking needs from the projects module (same contract as tasks). */
export interface ProjectAccess {
  assertRole(projectId: number, userId: number, required: ProjectRole): Promise<ProjectRole>;
}

export interface TimeEntryView {
  id: number;
  taskId: number;
  userId: number;
  startedAt: string;
  endedAt: string | null;
  minutes: number;
  manual: boolean;
}

export interface WeeklySummary {
  /** ISO week start (Monday 00:00 local). */
  weekStart: string;
  totalMinutes: number;
  perDay: { date: string; minutes: number }[];
  perTask: { taskId: number; taskTitle: string; minutes: number }[];
}

export interface CostSummary {
  /** Currency units booked so far (Σ tracked hours × rate). */
  bookedCost: number;
  /** Total tracked minutes across the project. */
  trackedMinutes: number;
  /** Members without any rate configured — their hours are unpriced. */
  unpricedMinutes: number;
  budget: number | null;
  hourlyRate: number | null;
  perMember: {
    userId: number;
    name: string;
    minutes: number;
    hourlyRate: number | null;
    cost: number | null;
  }[];
}

const taskNotFound = () => new NotFoundError('TASK_NOT_FOUND', 'Task not found');

export class TimeTrackingService {
  constructor(
    private readonly db: Db = prisma,
    private readonly access: ProjectAccess,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private async taskProject(taskId: number): Promise<number> {
    const task = await this.db.task.findFirst({
      where: { id: taskId, deletedAt: null, project: { deletedAt: null } },
      select: { projectId: true },
    });
    if (!task) throw taskNotFound();
    return task.projectId;
  }

  /** Starts the user's stopwatch on a task; closes any other open timer first. */
  async start(userId: number, taskId: number): Promise<TimeEntryView> {
    const projectId = await this.taskProject(taskId);
    await this.access.assertRole(projectId, userId, 'MEMBER');
    return this.db.$transaction(async (tx) => {
      // Single open timer per user — enforced app-side (SQLite/Postgres both run this serially).
      await tx.timeEntry.updateMany({
        where: { userId, endedAt: null },
        data: { endedAt: this.clock() },
      });
      const entry = await tx.timeEntry.create({
        data: { taskId, userId, startedAt: this.clock(), minutes: 0 },
      });
      return this.toView(entry);
    });
  }

  /** Stops the user's open timer (if any) and returns the closed entry. */
  async stop(userId: number, taskId: number): Promise<TimeEntryView | null> {
    const projectId = await this.taskProject(taskId);
    await this.access.assertRole(projectId, userId, 'MEMBER');
    const open = await this.db.timeEntry.findFirst({
      where: { userId, taskId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!open) return null;
    const now = this.clock();
    const minutes = Math.max(1, Math.round((now.getTime() - open.startedAt.getTime()) / 60000));
    const entry = await this.db.timeEntry.update({
      where: { id: open.id },
      data: { endedAt: now, minutes },
    });
    return this.toView(entry);
  }

  /** Manual entry for forgotten stopwatch time (§6 "the timer you forgot"). */
  async addManual(
    userId: number,
    taskId: number,
    input: { startedAt: Date; minutes: number },
  ): Promise<TimeEntryView> {
    if (input.minutes <= 0 || input.minutes > 24 * 60) {
      throw new ValidationError(null, 'minutes must be between 1 and 1440');
    }
    const projectId = await this.taskProject(taskId);
    await this.access.assertRole(projectId, userId, 'MEMBER');
    const entry = await this.db.timeEntry.create({
      data: {
        taskId,
        userId,
        startedAt: input.startedAt,
        endedAt: new Date(input.startedAt.getTime() + input.minutes * 60000),
        minutes: Math.round(input.minutes),
        manual: true,
      },
    });
    return this.toView(entry);
  }

  /** Open timer for the user, if any (drives the TaskSheet timer button). */
  async openTimer(userId: number): Promise<(TimeEntryView & { taskTitle: string }) | null> {
    const open = await this.db.timeEntry.findFirst({
      where: { userId, endedAt: null },
      orderBy: { startedAt: 'desc' },
      include: { task: { select: { title: true } } },
    });
    if (!open) return null;
    const minutes = Math.round((this.clock().getTime() - open.startedAt.getTime()) / 60000);
    return { ...this.toView(open), taskTitle: open.task.title, minutes };
  }

  async listForTask(userId: number, taskId: number): Promise<TimeEntryView[]> {
    const projectId = await this.taskProject(taskId);
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const rows = await this.db.timeEntry.findMany({
      where: { taskId },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    return rows.map((e) => this.toView(e));
  }

  /** Per-day/per-task totals for the current ISO week (Monday-based). */
  async weeklySummary(userId: number): Promise<WeeklySummary> {
    const now = this.clock();
    const day = (now.getDay() + 6) % 7; // Monday = 0
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const rows = await this.db.timeEntry.findMany({
      where: { userId, startedAt: { gte: weekStart, lt: weekEnd } },
      include: { task: { select: { id: true, title: true } } },
      orderBy: { startedAt: 'asc' },
    });

    const perDay = new Map<string, number>();
    const perTask = new Map<number, { title: string; minutes: number }>();
    let totalMinutes = 0;
    for (const r of rows) {
      perDay.set(r.startedAt.toISOString().slice(0, 10), (perDay.get(r.startedAt.toISOString().slice(0, 10)) ?? 0) + r.minutes);
      const existing = perTask.get(r.task.id) ?? { title: r.task.title, minutes: 0 };
      existing.minutes += r.minutes;
      perTask.set(r.task.id, existing);
      totalMinutes += r.minutes;
    }

    return {
      weekStart: weekStart.toISOString(),
      totalMinutes,
      perDay: [...perDay.entries()].map(([date, minutes]) => ({ date, minutes })),
      perTask: [...perTask.entries()].map(([taskId, v]) => ({ taskId, taskTitle: v.title, minutes: v.minutes })),
    };
  }

  /** §6 cost: tracked hours × member rate (override → project default → unpriced). */
  async projectCost(userId: number, projectId: number): Promise<CostSummary> {
    await this.access.assertRole(projectId, userId, 'VIEWER');
    const project = await this.db.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { hourlyRate: true, budgetAmount: true },
    });
    if (!project) throw new NotFoundError('PROJECT_NOT_FOUND', 'Project not found');

    const [entries, members] = await Promise.all([
      this.db.timeEntry.findMany({
        where: { task: { projectId, deletedAt: null } },
        select: { userId: true, minutes: true },
      }),
      this.db.projectMember.findMany({
        where: { projectId },
        select: { userId: true, hourlyRate: true, user: { select: { name: true } } },
      }),
    ]);

    const minutesBy = new Map<number, number>();
    for (const e of entries) minutesBy.set(e.userId, (minutesBy.get(e.userId) ?? 0) + e.minutes);

    let bookedCost = 0;
    let trackedMinutes = 0;
    let unpricedMinutes = 0;
    const perMember = members.map((m) => {
      const minutes = minutesBy.get(m.userId) ?? 0;
      trackedMinutes += minutes;
      const memberRate = m.hourlyRate === null ? null : Number(m.hourlyRate);
      const rate = memberRate ?? (project.hourlyRate !== null ? Number(project.hourlyRate) : null);
      const cost = rate === null ? null : (minutes / 60) * rate;
      if (cost === null) unpricedMinutes += minutes;
      else bookedCost += cost;
      return {
        userId: m.userId,
        name: m.user.name,
        minutes,
        hourlyRate: rate,
        cost: cost === null ? null : Math.round(cost * 100) / 100,
      };
    });

    return {
      bookedCost: Math.round(bookedCost * 100) / 100,
      trackedMinutes,
      unpricedMinutes,
      budget: project.budgetAmount === null ? null : Number(project.budgetAmount),
      hourlyRate: project.hourlyRate === null ? null : Number(project.hourlyRate),
      perMember: perMember.sort((a, b) => b.minutes - a.minutes),
    };
  }

  private toView(entry: {
    id: number;
    taskId: number;
    userId: number;
    startedAt: Date;
    endedAt: Date | null;
    minutes: number;
    manual: boolean;
  }): TimeEntryView {
    return {
      id: entry.id,
      taskId: entry.taskId,
      userId: entry.userId,
      startedAt: entry.startedAt.toISOString(),
      endedAt: entry.endedAt?.toISOString() ?? null,
      minutes: entry.minutes,
      manual: entry.manual,
    };
  }
}
