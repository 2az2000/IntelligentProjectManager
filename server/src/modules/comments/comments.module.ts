import { Router } from 'express';
import { z } from 'zod';
import type { Db } from '../../shared/db/prisma';
import { ForbiddenError, NotFoundError } from '../../shared/errors';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import { hasRole, type ProjectRole } from '../projects';

/** What comments need from the tasks module. */
export interface TaskAccess {
  assertTaskAccess(
    userId: number,
    taskId: number,
    required: ProjectRole,
  ): Promise<{ projectId: number; role: ProjectRole }>;
}

const authorSelect = { select: { id: true, name: true, avatarUrl: true } } as const;

type CommentRow = {
  id: number;
  taskId: number;
  body: string;
  author: { id: number; name: string; avatarUrl: string | null };
  createdAt: Date;
  updatedAt: Date;
};

const toCommentDto = (c: CommentRow) => ({
  id: c.id,
  taskId: c.taskId,
  body: c.body,
  author: c.author,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
  edited: c.updatedAt.getTime() - c.createdAt.getTime() > 1000,
});

export class CommentService {
  constructor(
    private readonly db: Db,
    private readonly tasks: TaskAccess,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(userId: number, taskId: number) {
    await this.tasks.assertTaskAccess(userId, taskId, 'VIEWER');
    return this.db.comment.findMany({
      where: { taskId, deletedAt: null },
      include: { author: authorSelect },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: number, taskId: number, body: string) {
    await this.tasks.assertTaskAccess(userId, taskId, 'MEMBER');
    return this.db.comment.create({
      data: { taskId, authorId: userId, body: body.trim() },
      include: { author: authorSelect },
    });
  }

  async update(userId: number, commentId: number, body: string) {
    const comment = await this.load(commentId);
    await this.tasks.assertTaskAccess(userId, comment.taskId, 'VIEWER');
    if (comment.authorId !== userId) {
      throw new ForbiddenError('NOT_COMMENT_AUTHOR', 'Only the author can edit this comment');
    }
    return this.db.comment.update({
      where: { id: commentId },
      data: { body: body.trim() },
      include: { author: authorSelect },
    });
  }

  async remove(userId: number, commentId: number): Promise<void> {
    const comment = await this.load(commentId);
    const { role } = await this.tasks.assertTaskAccess(userId, comment.taskId, 'VIEWER');
    if (comment.authorId !== userId && !hasRole(role, 'ADMIN')) {
      throw new ForbiddenError('NOT_COMMENT_AUTHOR', 'Only the author or an admin can delete this comment');
    }
    await this.db.comment.update({ where: { id: commentId }, data: { deletedAt: this.clock() } });
  }

  private async load(commentId: number) {
    const comment = await this.db.comment.findFirst({ where: { id: commentId, deletedAt: null } });
    if (!comment) throw new NotFoundError('COMMENT_NOT_FOUND', 'Comment not found');
    return comment;
  }
}

const id = z.coerce.number().int().positive();
const bodySchema = z.object({ body: z.string().trim().min(1).max(5000) }).strict();

export function createCommentsModule(deps: { db: Db; tasks: TaskAccess }) {
  const service = new CommentService(deps.db, deps.tasks);

  /** Mounted at /tasks/:taskId/comments */
  const taskCommentsRouter = Router({ mergeParams: true });
  taskCommentsRouter.use(requireAuth);
  taskCommentsRouter.get(
    '/',
    handle({ params: z.object({ taskId: id }) }, async ({ params }, req, res) => {
      res.json((await service.list(currentUserId(req), params.taskId)).map(toCommentDto));
    }),
  );
  taskCommentsRouter.post(
    '/',
    handle({ params: z.object({ taskId: id }), body: bodySchema }, async ({ params, body }, req, res) => {
      res.status(201).json(toCommentDto(await service.create(currentUserId(req), params.taskId, body.body)));
    }),
  );

  /** Mounted at /comments */
  const commentsRouter = Router();
  commentsRouter.use(requireAuth);
  commentsRouter.patch(
    '/:commentId',
    handle({ params: z.object({ commentId: id }), body: bodySchema }, async ({ params, body }, req, res) => {
      res.json(toCommentDto(await service.update(currentUserId(req), params.commentId, body.body)));
    }),
  );
  commentsRouter.delete(
    '/:commentId',
    handle({ params: z.object({ commentId: id }) }, async ({ params }, req, res) => {
      await service.remove(currentUserId(req), params.commentId);
      res.status(204).end();
    }),
  );

  return { service, taskCommentsRouter, commentsRouter };
}
