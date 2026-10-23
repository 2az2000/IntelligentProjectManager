import { createReadStream } from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import { AVATAR_MAX_BYTES, type UsersService } from './users.service';
import { LOCALES, THEMES, toUserDto } from './users.types';

const searchQuery = z.object({ search: z.string().trim().min(2).max(100) });

const updateMeBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    avatarUrl: z.url({ protocol: /^https?$/ }).max(500).nullable(),
    locale: z.enum(LOCALES),
    theme: z.enum(THEMES).nullable(),
    notifyEmail: z.boolean(),
    /** §4 onboarding: the client stamps this once the tour is finished or skipped. */
    onboardedAt: z.coerce.date().nullable(),
  })
  .partial()
  .strict();

/** Mounted at /users */
export function createUsersRouter(users: UsersService): Router {
  const router = Router();
  router.use(requireAuth);

  // Used to find people to invite to a project.
  router.get(
    '/',
    handle({ query: searchQuery }, async ({ query }, _req, res) => {
      res.json(await users.search(query.search));
    }),
  );

  router.patch(
    '/me',
    handle({ body: updateMeBody }, async ({ body }, req, res) => {
      res.json(toUserDto(await users.updateProfile(currentUserId(req), body)));
    }),
  );

  // Alternative to the avatarUrl field: upload the image itself (multipart field "file").
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  });
  router.post(
    '/me/avatar',
    upload.single('file'),
    handle({}, async (_params, req, res) => {
      if (!req.file) throw new ValidationError(null, 'An image file is required (multipart field "file")');
      res.json(toUserDto(await users.updateAvatar(currentUserId(req), req.file)));
    }),
  );

  return router;
}

const AVATAR_CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Mounted at /avatars — intentionally public: avatars render inside <img> tags from the SPA
 * origin. Names are server-minted UUIDs (unguessable), read-only and cacheable.
 */
export function createAvatarsRouter(users: UsersService): Router {
  const router = Router();

  router.get(
    '/:fileName',
    handle({ params: z.object({ fileName: z.string().max(64) }) }, async ({ params }, _req, res) => {
      const avatar = await users.avatarPath(params.fileName);
      if (!avatar) throw new NotFoundError('AVATAR_NOT_FOUND', 'Avatar not found');
      const extension = params.fileName.split('.').pop() ?? '';
      res.setHeader('Content-Type', AVATAR_CONTENT_TYPES[extension] ?? 'application/octet-stream');
      res.setHeader('Content-Length', avatar.size);
      // Content-addressed names never change, so the bytes are cacheable forever.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      // The SPA and the API are different origins — helmet's same-origin CORP would block <img>.
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      createReadStream(avatar.absolute).pipe(res);
    }),
  );

  return router;
}
