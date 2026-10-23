import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../../shared/logger';
import type { Db } from '../../shared/db/prisma';
import { NotFoundError } from '../../shared/errors';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import { publish } from '../../shared/realtime/bus';

export const NOTIFICATION_TYPES = [
  'ASSIGNED',
  'COMMENTED',
  'MENTIONED',
  'DUE_REMINDER',
  'DAILY_DIGEST',
  'WEEKLY_SUMMARY',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationInput {
  userId: number;
  type: NotificationType;
  actorId?: number | null;
  taskId?: number | null;
  projectId?: number | null;
}

const include = {
  actor: { select: { id: true, name: true, avatarUrl: true } },
  task: { select: { id: true, title: true, projectId: true, project: { select: { id: true, name: true } } } },
} as const;


const toDto = (
  row: {
    id: number;
    type: string;
    projectId: number | null;
    actor: { id: number; name: string; avatarUrl: string | null } | null;
    task: { id: number; title: string; projectId: number; project: { id: number; name: string } } | null;
    readAt: Date | null;
    createdAt: Date;
  },
  projectName: string | null,
) => ({
  id: row.id,
  type: row.type,
  actor: row.actor,
  task: row.task ? { id: row.task.id, title: row.task.title, projectId: row.task.projectId, projectName: row.task.project.name } : null,
  /** Set on project-level rows (WEEKLY_SUMMARY), where there is no task to carry it. */
  projectId: row.projectId,
  projectName,
  read: row.readAt !== null,
  createdAt: row.createdAt.toISOString(),
});

export class NotificationService {
  constructor(private readonly db: Db) {}

  /** Creates the notification and pokes the recipient's realtime room. Never self-notifies. */
  async create(input: NotificationInput) {
    if (input.actorId != null && input.actorId === input.userId) return null;
    const row = await this.db.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        actorId: input.actorId ?? null,
        taskId: input.taskId ?? null,
        projectId: input.projectId ?? null,
      },
    });
    publish('notification:new', { userId: input.userId, type: input.type });
    return row;
  }

  /** Fire-and-forget wrapper for service hooks — a notification failure must not fail the request. */
  safeCreate(input: NotificationInput): void {
    this.create(input).catch((err: unknown) => logger.warn({ err }, 'Failed to create notification'));
  }

  async list(userId: number, limit = 20) {
    const rows = await this.db.notification.findMany({
      where: { userId },
      include,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 50),
    });
    const projectIds = [...new Set(rows.map((row) => row.projectId).filter((id): id is number => id !== null))];
    const projects = projectIds.length
      ? await this.db.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(projects.map((p) => [p.id, p.name]));
    return rows.map((row) => toDto(row, row.projectId === null ? null : (nameById.get(row.projectId) ?? null)));
  }

  async unreadCount(userId: number): Promise<number> {
    return this.db.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: number, notificationId: number) {
    const row = await this.db.notification.findUnique({ where: { id: notificationId } });
    if (!row || row.userId !== userId) throw new NotFoundError('NOTIFICATION_NOT_FOUND', 'Notification not found');
    await this.db.notification.update({ where: { id: row.id }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: number): Promise<void> {
    await this.db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  }
}

const id = z.coerce.number().int().positive();
const listQuery = z.object({ limit: z.coerce.number().int().positive().max(50).optional() });

export function createNotificationsModule(deps: { db: Db }) {
  const service = new NotificationService(deps.db);
  return { service, notificationsRouter: createNotificationsRouter(service) };
}

/** Mounted at /notifications */
export function createNotificationsRouter(service: NotificationService): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    handle({ query: listQuery }, async ({ query }, req, res) => {
      res.json(await service.list(currentUserId(req), query.limit));
    }),
  );

  router.get(
    '/unread-count',
    handle({}, async (_params, req, res) => {
      res.json({ count: await service.unreadCount(currentUserId(req)) });
    }),
  );

  router.post(
    '/read-all',
    handle({}, async (_params, req, res) => {
      await service.markAllRead(currentUserId(req));
      res.status(204).end();
    }),
  );

  router.post(
    '/:notificationId/read',
    handle({ params: z.object({ notificationId: id }) }, async ({ params }, req, res) => {
      await service.markRead(currentUserId(req), params.notificationId);
      res.status(204).end();
    }),
  );

  return router;
}
