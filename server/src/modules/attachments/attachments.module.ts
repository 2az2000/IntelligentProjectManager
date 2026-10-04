import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';
import type { Db } from '../../shared/db/prisma';
import { ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import type { ProjectRole } from '../projects';

/** What attachments need from the tasks module (access check only). */
export interface TaskAccess {
  assertTaskAccess(
    userId: number,
    taskId: number,
    required: ProjectRole,
  ): Promise<{ projectId: number; role: ProjectRole }>;
}

const MAX_BYTES = env.MAX_UPLOAD_MB * 1024 * 1024;

/** Resolve inside UPLOAD_DIR and refuse traversal — the client never dictates the path. */
function resolveStorageKey(taskId: number): string {
  const key = path.posix.join(String(taskId), `${randomUUID()}.bin`);
  const resolved = path.resolve(env.UPLOAD_DIR, key);
  if (!resolved.startsWith(path.resolve(env.UPLOAD_DIR))) {
    throw new ValidationError(null, 'Invalid storage key');
  }
  return key.split('\\').join('/');
}

export class AttachmentService {
  constructor(
    private readonly db: Db,
    private readonly tasks: TaskAccess,
  ) {}

  private readonly uploadDir = path.resolve(env.UPLOAD_DIR);

  async create(userId: number, taskId: number, file: Express.Multer.File) {
    await this.tasks.assertTaskAccess(userId, taskId, 'MEMBER');
    // Second line of defense behind multer's limits (guards direct service calls).
    if (file.size > MAX_BYTES) {
      throw new ValidationError(null, `File exceeds the ${env.MAX_UPLOAD_MB} MB limit`);
    }
    if (file.size === 0) throw new ValidationError(null, 'Empty files are not allowed');

    const storageKey = resolveStorageKey(taskId);
    const absolute = path.join(this.uploadDir, storageKey);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, file.buffer);

    try {
      const row = await this.db.attachment.create({
        data: {
          taskId,
          uploaderId: userId,
          fileName: sanitizeFileName(file.originalname),
          mimeType: file.mimetype || 'application/octet-stream',
          size: file.size,
          storageKey,
        },
        include: { uploader: userSummary },
      });
      return toAttachmentDto(row);
    } catch (err) {
      // DB write failed — do not orphan the bytes on disk.
      await unlink(absolute).catch(() => undefined);
      throw err;
    }
  }

  async list(userId: number, taskId: number) {
    await this.tasks.assertTaskAccess(userId, taskId, 'VIEWER');
    const rows = await this.db.attachment.findMany({
      where: { taskId },
      include: { uploader: userSummary },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAttachmentDto);
  }

  async remove(userId: number, attachmentId: number): Promise<void> {
    const row = await this.load(attachmentId);
    const { role } = await this.tasks.assertTaskAccess(userId, row.taskId, 'MEMBER');
    if (row.uploaderId !== userId && role !== 'ADMIN' && role !== 'OWNER') {
      throw new ForbiddenError('INSUFFICIENT_ROLE', 'Only the uploader or a project admin can delete this attachment');
    }
    await this.db.attachment.delete({ where: { id: attachmentId } });
    await unlink(path.join(this.uploadDir, row.storageKey)).catch((err: unknown) =>
      logger.warn({ err }, 'Attachment file already gone'),
    );
  }

  /** Authenticated streaming download — no public links, cookies gate every byte. */
  async download(userId: number, attachmentId: number) {
    const row = await this.load(attachmentId);
    await this.tasks.assertTaskAccess(userId, row.taskId, 'VIEWER');
    return row;
  }

  /** Absolute path of a stored attachment (router streams it). */
  absolutePath(row: { storageKey: string }): string {
    return path.join(this.uploadDir, row.storageKey);
  }

  private async load(attachmentId: number) {
    const row = await this.db.attachment.findUnique({ where: { id: attachmentId } });
    if (!row) throw new NotFoundError('ATTACHMENT_NOT_FOUND', 'Attachment not found');
    return row;
  }
}

const userSummary = { select: { id: true, name: true, avatarUrl: true } } as const;

const toAttachmentDto = (row: {
  id: number;
  taskId: number;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  uploader: { id: number; name: string; avatarUrl: string | null };
}) => ({
  id: row.id,
  taskId: row.taskId,
  fileName: row.fileName,
  mimeType: row.mimeType,
  size: row.size,
  uploader: row.uploader,
  createdAt: row.createdAt.toISOString(),
});

/** Strip any path component and control characters, then cap the display name. */
function sanitizeFileName(name: string): string {
  const base = [...path.basename(name)]
    .map((ch) => (ch < ' ' || ch === '\\' || ch === '/' ? '_' : ch))
    .join('')
    .trim();
  return (base || 'file').slice(0, 200);
}

const id = z.coerce.number().int().positive();

export function createAttachmentsModule(deps: { db: Db; tasks: TaskAccess }) {
  const service = new AttachmentService(deps.db, deps.tasks);
  return {
    service,
    taskAttachmentsRouter: createTaskAttachmentsRouter(service),
    attachmentsRouter: createAttachmentsRouter(service),
  };
}

/** Mounted at /tasks/:taskId/attachments */
export function createTaskAttachmentsRouter(service: AttachmentService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_BYTES, files: 1 },
  });

  router.get(
    '/',
    handle({ params: z.object({ taskId: id }) }, async ({ params }, req, res) => {
      res.json(await service.list(currentUserId(req), params.taskId));
    }),
  );

  router.post(
    '/',
    requireAuth,
    upload.single('file'),
    handle({ params: z.object({ taskId: id }) }, async ({ params }, req, res) => {
      const file = req.file;
      if (!file) throw new ValidationError(null, 'A file is required (multipart field "file")');
      res.status(201).json(await service.create(currentUserId(req), params.taskId, file));
    }),
  );

  return router;
}

/** Mounted at /attachments */
export function createAttachmentsRouter(service: AttachmentService): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/:attachmentId/download',
    handle({ params: z.object({ attachmentId: id }) }, async ({ params }, req, res) => {
      const row = await service.download(currentUserId(req), params.attachmentId);
      res.setHeader('Content-Type', row.mimeType);
      res.setHeader('Content-Length', row.size);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(row.fileName)}`);
      createReadStream(service.absolutePath(row)).pipe(res);
    }),
  );

  router.delete(
    '/:attachmentId',
    handle({ params: z.object({ attachmentId: id }) }, async ({ params }, req, res) => {
      await service.remove(currentUserId(req), params.attachmentId);
      res.status(204).end();
    }),
  );

  return router;
}
