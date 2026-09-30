import { createHmac, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

interface AccessPayload {
  sub: string;
}

export function signAccessToken(userId: number): string {
  return jwt.sign({} satisfies Partial<AccessPayload>, env.JWT_ACCESS_SECRET, {
    subject: String(userId),
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
    algorithm: 'HS256',
  });
}

export type AccessTokenResult =
  | { ok: true; userId: number }
  | { ok: false; reason: 'expired' | 'invalid' };

export function verifyAccessToken(token: string): AccessTokenResult {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    const userId = typeof payload === 'object' ? Number(payload.sub) : NaN;
    return Number.isInteger(userId) && userId > 0 ? { ok: true, userId } : { ok: false, reason: 'invalid' };
  } catch (err) {
    return { ok: false, reason: err instanceof jwt.TokenExpiredError ? 'expired' : 'invalid' };
  }
}

/** Opaque refresh token: 256 random bits. Only its HMAC is stored in the database. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
}
