import type { Request, RequestHandler } from 'express';
import { UnauthorizedError } from '../errors';
import { ACCESS_COOKIE, verifyAccessToken } from './tokens';

function readToken(req: Request): string | undefined {
  const cookie: unknown = req.cookies?.[ACCESS_COOKIE];
  if (typeof cookie === 'string' && cookie) return cookie;
  const header = req.headers.authorization;
  return header?.startsWith('Bearer ') ? header.slice(7) : undefined;
}

/** Authenticates the request from the access-token cookie (or a Bearer header for API clients). */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next(new UnauthorizedError());

  const result = verifyAccessToken(token);
  if (!result.ok) {
    return next(
      result.reason === 'expired'
        ? new UnauthorizedError('TOKEN_EXPIRED', 'Access token expired')
        : new UnauthorizedError('INVALID_TOKEN', 'Invalid access token'),
    );
  }
  req.user = { id: result.userId };
  next();
};

/** The authenticated user id; only valid behind requireAuth. */
export function currentUserId(req: Request): number {
  if (!req.user) throw new UnauthorizedError();
  return req.user.id;
}
