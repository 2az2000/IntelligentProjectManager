import { env } from '../../config/env';
import type { Db } from '../../shared/db/prisma';
import { calendarDaysBetween, endOfDayIn } from '../../shared/time/day-bounds';
import type { TaskPriority, TaskStatus } from '../tasks';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows the digest carries before it stops being a glance and becomes a report. */
const MAX_TASKS = 50;
/** Projects listed in the per-project breakdown. */
const MAX_PROJECTS = 6;

export interface DigestTask {
  id: number;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  projectId: number;
  projectName: string;
  overdue: boolean;
  /** Whole days past due (>= 1 while overdue, 0 otherwise). */
  overdueByDays: number;
  /** Whole days until due (negative while overdue, null without a due date). */
  daysUntilDue: number | null;
}

export interface DigestProject {
  projectId: number;
  projectName: string;
  open: number;
  overdue: number;
}

/**
 * The daily report one user sees in `GET /dashboard/digest` *and* in the 08:00 email.
 * Same numbers in both places is the point: the mail and the modal must not disagree.
 */
export interface Digest {
  generatedAt: string;
  open: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  /** Finished in the last 24h — the "what moved yesterday" line. */
  completedSinceYesterday: number;
  /** Mine, not done, and already started (IN_PROGRESS or REVIEW). */
  inProgress: number;
  /** Age of the oldest overdue task; 0 when nothing is overdue. */
  overdueByDays: number;
  tasks: DigestTask[];
  perProject: DigestProject[];
}

/**
 * Whole calendar days between two instants, counted midnight-to-midnight in the user's zone.
 * The server's own zone is never consulted: production images run in UTC, so boxing a 01:00
 * Tehran completion into "yesterday" was a real off-by-one.
 */
function wholeDays(from: Date, to: Date, timeZone: string): number {
  return Math.max(0, calendarDaysBetween(from, to, timeZone));
}

/**
 * Builds the digest for one user. `projectIds` is passed in (rather than queried here) so the
 * membership rule stays owned by the caller — the dashboard service and the nightly job scope
 * projects the same way the rest of their code does.
 */
export async function buildDigest(
  db: Db,
  input: { userId: number; projectIds: number[]; now?: Date; timeZone?: string },
): Promise<Digest> {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? env.APP_TIME_ZONE;
  const dayEnd = endOfDayIn(timeZone, now);
  const weekEnd = new Date(now.getTime() + 7 * DAY_MS);
  const sinceYesterday = new Date(now.getTime() - DAY_MS);

  const live = { projectId: { in: input.projectIds }, deletedAt: null, project: { deletedAt: null } };
  // "Mine" = the lead or a co-assignee: sharing a task means it shows up in the digest.
  const mine = { OR: [{ assigneeId: input.userId }, { collaborators: { some: { userId: input.userId } } }] };
  const mineOpen = { ...live, ...mine, status: { not: 'DONE' as const } };

  if (input.projectIds.length === 0) {
    return {
      generatedAt: now.toISOString(),
      open: 0,
      overdue: 0,
      dueToday: 0,
      dueThisWeek: 0,
      completedSinceYesterday: 0,
      inProgress: 0,
      overdueByDays: 0,
      tasks: [],
      perProject: [],
    };
  }

  const [open, overdue, dueToday, dueThisWeek, completedSinceYesterday, inProgress, rows, openByProject, overdueByProject, projects] =
    await Promise.all([
      db.task.count({ where: mineOpen }),
      db.task.count({ where: { ...mineOpen, dueDate: { lt: now } } }),
      db.task.count({ where: { ...mineOpen, dueDate: { gte: now, lte: dayEnd } } }),
      db.task.count({ where: { ...mineOpen, dueDate: { gte: now, lte: weekEnd } } }),
      db.task.count({ where: { ...live, ...mine, completedAt: { gte: sinceYesterday } } }),
      db.task.count({ where: { ...mineOpen, status: { in: ['IN_PROGRESS', 'REVIEW'] } } }),
      db.task.findMany({
        where: { ...mineOpen, dueDate: { lte: dayEnd } },
        orderBy: { dueDate: 'asc' },
        take: MAX_TASKS,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
        },
      }),
      db.task.groupBy({ by: ['projectId'], where: mineOpen, _count: { _all: true } }),
      db.task.groupBy({ by: ['projectId'], where: { ...mineOpen, dueDate: { lt: now } }, _count: { _all: true } }),
      db.project.findMany({
        where: { id: { in: input.projectIds }, deletedAt: null },
        select: { id: true, name: true },
      }),
    ]);

  const tasks: DigestTask[] = rows.map((t) => {
    const due = t.dueDate;
    const isOverdue = due !== null && due < now;
    const days =
      due === null
        ? null
        : isOverdue
          ? Math.max(1, wholeDays(due, now, timeZone))
          : wholeDays(now, due, timeZone);
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueDate: due?.toISOString() ?? null,
      projectId: t.project.id,
      projectName: t.project.name,
      overdue: isOverdue,
      overdueByDays: isOverdue ? (days ?? 0) : 0,
      daysUntilDue: isOverdue ? -(days ?? 0) : days,
    };
  });

  const nameById = new Map(projects.map((p) => [p.id, p.name]));
  const overdueCounts = new Map(overdueByProject.map((row) => [row.projectId, row._count._all]));
  const perProject: DigestProject[] = openByProject
    .map((row) => ({
      projectId: row.projectId,
      projectName: nameById.get(row.projectId) ?? '',
      open: row._count._all,
      overdue: overdueCounts.get(row.projectId) ?? 0,
    }))
    .filter((row) => row.projectName !== '')
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open)
    .slice(0, MAX_PROJECTS);

  return {
    generatedAt: now.toISOString(),
    open,
    overdue,
    dueToday,
    dueThisWeek,
    completedSinceYesterday,
    inProgress,
    overdueByDays: tasks.reduce((max, t) => Math.max(max, t.overdueByDays), 0),
    tasks,
    perProject,
  };
}
