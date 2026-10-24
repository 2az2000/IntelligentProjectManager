import {
  ACTIVITY_ACTIONS,
  ACTIVITY_MAX_PAGE_SIZE,
  ACTIVITY_PAGE_SIZE,
  type ActivityAction,
  type ActivityPage,
} from '@managesys/contracts';
import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../shared/logger';
import type { Db } from '../../shared/db/prisma';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import type { TaskFieldChange } from '../../shared/realtime/bus';
import type { ProjectRole } from '../projects';

/** What activity needs from the tasks module (access check only). */
export interface TaskAccess {
  assertTaskAccess(
    userId: number,
    taskId: number,
    required: ProjectRole,
  ): Promise<{ projectId: number; role: ProjectRole }>;
}

export interface TaskActivityEvent {
  actorId: number;
  taskId: number;
  action: ActivityAction;
  changes?: TaskFieldChange[];
}

// Page sizes are shared with the client so its "load more" asks for exactly one page.
export { ACTIVITY_MAX_PAGE_SIZE, ACTIVITY_PAGE_SIZE };

/** The column is a string in the database; anything unexpected reads as a plain edit. */
const asAction = (value: string): ActivityAction =>
  (ACTIVITY_ACTIONS as readonly string[]).includes(value) ? (value as ActivityAction) : 'updated';

export class ActivityService {
  constructor(
    private readonly db: Db,
    private readonly tasks: TaskAccess,
  ) {}

  /**
   * Records activity rows. Awaited by the composition root so entries exist
   * before the HTTP response — rejections are caught there, not by callers.
   */
  async record(event: TaskActivityEvent): Promise<void> {
    const rows =
      event.changes && event.changes.length > 0
        ? event.changes.map((c) => ({
            taskId: event.taskId,
            actorId: event.actorId,
            action: event.action,
            field: c.field,
            oldValue: c.oldValue ?? null,
            newValue: c.newValue ?? null,
          }))
        : [
            {
              taskId: event.taskId,
              actorId: event.actorId,
              action: event.action,
              field: null,
              oldValue: null,
              newValue: null,
            },
          ];

    try {
      await this.db.activityLog.createMany({ data: rows });
    } catch (err: unknown) {
      logger.warn({ err }, 'Failed to record task activity');
    }
  }

  async list(
    userId: number,
    taskId: number,
    { limit = ACTIVITY_PAGE_SIZE, cursor }: { limit?: number; cursor?: number } = {},
  ): Promise<ActivityPage> {
    await this.tasks.assertTaskAccess(userId, taskId, 'VIEWER');
    const take = Math.min(Math.max(limit, 1), ACTIVITY_MAX_PAGE_SIZE);
    // `take + 1` is the peek that tells us whether another page exists without a second query.
    const [rows, total, actors] = await Promise.all([
      this.db.activityLog.findMany({
        where: { taskId },
        include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
        // `id` breaks ties: one change records several rows in a single createMany (same createdAt).
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      }),
      this.db.activityLog.count({ where: { taskId } }),
      // The header counts the whole history, not just the loaded page.
      this.db.activityLog.groupBy({ by: ['actorId'], where: { taskId } }),
    ]);
    const page = rows.slice(0, take);
    return {
      items: page.map((row) => ({
        id: row.id,
        taskId: row.taskId,
        action: asAction(row.action),
        field: row.field,
        oldValue: row.oldValue,
        newValue: row.newValue,
        actor: row.actor,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length > take ? (page.at(-1)?.id ?? null) : null,
      total,
      people: actors.length,
    };
  }
}

export function createActivityModule(deps: { db: Db; tasks: TaskAccess }) {
  const service = new ActivityService(deps.db, deps.tasks);
  return { service, activityRouter: createActivityRouter(service) };
}

const id = z.coerce.number().int().positive();

/** Mounted at /tasks/:taskId/activity */
export function createActivityRouter(service: ActivityService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    handle(
      {
        params: z.object({ taskId: id }),
        query: z.object({
          limit: z.coerce.number().int().min(1).max(ACTIVITY_MAX_PAGE_SIZE).optional(),
          cursor: z.coerce.number().int().positive().optional(),
        }),
      },
      async ({ params, query }, req, res) => {
        res.json(await service.list(currentUserId(req), params.taskId, query));
      },
    ),
  );

  return router;
}
