import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import type { UsersService } from './users.service';
import { LOCALES, THEMES, toUserDto } from './users.types';

const searchQuery = z.object({ search: z.string().trim().min(2).max(100) });

const updateMeBody = z
  .object({
    name: z.string().trim().min(1).max(80),
    avatarUrl: z.url({ protocol: /^https?$/ }).max(500).nullable(),
    locale: z.enum(LOCALES),
    theme: z.enum(THEMES).nullable(),
    notifyEmail: z.boolean(),
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

  return router;
}
