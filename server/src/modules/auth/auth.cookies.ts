import type { CookieOptions, Response } from 'express';
import { env, isProduction } from '../../config/env';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../../shared/auth/tokens';
import type { AuthTokens } from './auth.service';

const base: CookieOptions = { httpOnly: true, sameSite: 'lax', secure: isProduction };
// The refresh token is only ever sent to the auth endpoints.
const refreshOptions: CookieOptions = { ...base, path: '/auth' };
const accessOptions: CookieOptions = { ...base, path: '/' };

export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...accessOptions,
    maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000,
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...refreshOptions,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, accessOptions);
  res.clearCookie(REFRESH_COOKIE, refreshOptions);
}
