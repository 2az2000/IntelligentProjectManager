import { Router } from 'express';
import type { Db } from '../../shared/db/prisma';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import { TASK_STATUSES, type TaskStatus } from '../tasks';
import { buildDigest } from './digest';

export { buildDigest, type Digest, type DigestTask, type DigestProject } from './digest';

/**
 * Read model for the dashboard (CQRS read side): aggregate queries only, no business rules.
 * It reads task/project tables directly for efficiency; access is scoped by membership.
 */
export interface ProjectMembership {
  projectIdsForUser(userId: number): Promise<number[]>;
}

const DAY = 24 * 60 * 60 * 1000;

export class DashboardService {
  constructor(
    private readonly db: Db,
    private readonly projects: ProjectMembership,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async summary(userId: number) {
    const now = this.clock();
    const weekEnd = new Date(now.getTime() + 7 * DAY);
    const projectIds = await this.projects.projectIdsForUser(userId);

    const live = { projectId: { in: projectIds }, deletedAt: null, project: { deletedAt: null } };
    // "Mine" means the user is on the task — as the lead or as a co-assignee — and it is not done.
    const mineOpen = {
      ...live,
      status: { not: 'DONE' as const },
      OR: [{ assigneeId: userId }, { collaborators: { some: { userId } } }],
    };

    const [myOpenTasks, overdue, dueThisWeek, byStatusRows, completedThisWeek, upcoming, recent] =
      await Promise.all([
        this.db.task.count({ where: mineOpen }),
        this.db.task.count({ where: { ...mineOpen, dueDate: { lt: now } } }),
        this.db.task.count({ where: { ...mineOpen, dueDate: { gte: now, lte: weekEnd } } }),
        this.db.task.groupBy({
          by: ['status'],
          where: { ...live, parentId: null },
          _count: { _all: true },
        }),
        this.db.task.count({
          where: { ...live, completedAt: { gte: new Date(now.getTime() - 7 * DAY) } },
        }),
        this.db.task.findMany({
          where: { ...mineOpen, dueDate: { not: null } },
          orderBy: { dueDate: 'asc' },
          take: 6,
          select: {
            id: true,
            title: true,
            dueDate: true,
            priority: true,
            status: true,
            project: { select: { id: true, name: true } },
          },
        }),
        this.db.project.findMany({
          where: { id: { in: projectIds }, deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: { id: true, name: true, updatedAt: true },
        }),
      ]);

    const byStatus = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
    for (const row of byStatusRows) byStatus[row.status] = row._count._all;

    return {
      projectCount: projectIds.length,
      myOpenTasks,
      overdue,
      dueThisWeek,
      completedThisWeek,
      byStatus,
      upcoming: upcoming.map((t) => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null })),
      recentProjects: recent.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() })),
    };
  }

  /**
   * §5 daily digest: exactly the payload the 08:00 email is rendered from, plus the concrete
   * tasks behind the numbers — the notification client shows this report in a modal.
   */
  async digest(userId: number) {
    const projectIds = await this.projects.projectIdsForUser(userId);
    return buildDigest(this.db, { userId, projectIds, now: this.clock() });
  }
}

export function createDashboardModule(deps: { db: Db; projects: ProjectMembership }) {
  const service = new DashboardService(deps.db, deps.projects);
  const router = Router();
  router.use(requireAuth);
  router.get(
    '/summary',
    handle({}, async (_input, req, res) => {
      res.json(await service.summary(currentUserId(req)));
    }),
  );
  router.get(
    '/digest',
    handle({}, async (_input, req, res) => {
      res.json(await service.digest(currentUserId(req)));
    }),
  );
  return { service, router };
}
