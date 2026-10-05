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
  action: 'created' | 'updated' | 'moved' | 'deleted';
  changes?: TaskFieldChange[];
}

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

  async list(userId: number, taskId: number, limit = 50) {
    await this.tasks.assertTaskAccess(userId, taskId, 'VIEWER');
    const rows = await this.db.activityLog.findMany({
      where: { taskId },
      include: { actor: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      action: row.action,
      field: row.field,
      oldValue: row.oldValue,
      newValue: row.newValue,
      actor: row.actor,
      createdAt: row.createdAt.toISOString(),
    }));
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
    handle({ params: z.object({ taskId: id }) }, async ({ params }, req, res) => {
      res.json(await service.list(currentUserId(req), params.taskId));
    }),
  );

  return router;
}
