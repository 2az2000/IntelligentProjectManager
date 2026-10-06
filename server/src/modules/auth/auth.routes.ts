import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { isTest } from '../../config/env';
import { AppError } from '../../shared/errors';
import { handle } from '../../shared/http/handle';
import { REFRESH_COOKIE } from '../../shared/auth/tokens';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { toUserDto, type UsersService } from '../users';
import { clearAuthCookies, setAuthCookies } from './auth.cookies';
import type { AuthService } from './auth.service';
import {
  changePasswordBody,
  forgotPasswordBody,
  loginBody,
  registerBody,
  resetPasswordBody,
} from './auth.schemas';

const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) =>
    next(new AppError(429, 'RATE_LIMITED', 'Too many attempts, please try again later')),
});

const readRefreshCookie = (cookies: unknown): string | undefined => {
  const value = (cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
};

export function createAuthRouter(auth: AuthService, users: UsersService): Router {
  const router = Router();

  router.post(
    '/register',
    credentialsLimiter,
    handle({ body: registerBody }, async ({ body }, _req, res) => {
      const { user, tokens } = await auth.register(body);
      setAuthCookies(res, tokens);
      res.status(201).json(toUserDto(user));
    }),
  );

  router.post(
    '/login',
    credentialsLimiter,
    handle({ body: loginBody }, async ({ body }, _req, res) => {
      const { user, tokens } = await auth.login(body);
      setAuthCookies(res, tokens);
      res.json(toUserDto(user));
    }),
  );

  router.post(
    '/refresh',
    handle({}, async (_input, req, res) => {
      try {
        setAuthCookies(res, await auth.refresh(readRefreshCookie(req.cookies)));
      } catch (err) {
        clearAuthCookies(res);
        throw err;
      }
      res.status(204).end();
    }),
  );

  router.post(
    '/logout',
    handle({}, async (_input, req, res) => {
      await auth.logout(readRefreshCookie(req.cookies));
      clearAuthCookies(res);
      res.status(204).end();
    }),
  );

  // §11: anti-enumeration — always 204, whether or not the email exists.
  router.post(
    '/forgot-password',
    credentialsLimiter,
    handle({ body: forgotPasswordBody }, async ({ body }, req, res) => {
      const origin = `${req.protocol}://${req.get('host')}`;
      await auth.requestPasswordReset(body.email, origin);
      res.status(204).end();
    }),
  );

  router.post(
    '/reset-password',
    credentialsLimiter,
    handle({ body: resetPasswordBody }, async ({ body }, _req, res) => {
      await auth.resetPassword(body.token, body.newPassword);
      clearAuthCookies(res); // old session cookies are worthless now
      res.status(204).end();
    }),
  );

  router.post(
    '/change-password',
    requireAuth,
    credentialsLimiter,
    handle({ body: changePasswordBody }, async ({ body }, req, res) => {
      setAuthCookies(res, await auth.changePassword(currentUserId(req), body));
      res.status(204).end();
    }),
  );

  router.get(
    '/me',
    requireAuth,
    handle({}, async (_input, req, res) => {
      res.json(toUserDto(await users.getById(currentUserId(req))));
    }),
  );

  return router;
}
