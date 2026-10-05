import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../errors';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Extracts the origin part of a Referer header (fallback when Origin is absent). */
function refererOrigin(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/**
 * CSRF defense-in-depth for cookie authentication.
 *
 * Browsers attach httpOnly auth cookies to every request to our origin,
 * including forged cross-site form posts that CORS cannot block (simple
 * requests skip preflight). For any state-changing request that *declares* an
 * Origin/Referer not on our allowlist we answer 403 before touching data.
 *
 * Non-browser clients (curl, supertest, native apps) send no Origin and pass
 * through — the allowlist is the same CORS_ORIGIN env used by the cors
 * middleware, so browsers on allowed origins are unaffected.
 */
export function originGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!UNSAFE_METHODS.has(req.method)) return next();

  const header = req.headers.origin ?? refererOrigin(req.headers.referer);
  if (!header) return next(); // not a browser-driven request

  const origin = header.replace(/\/$/, '');
  if (env.CORS_ORIGIN.includes(origin)) return next();

  next(new AppError(403, 'CSRF_ORIGIN_MISMATCH', 'Cross-site request blocked'));
}
