import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const url = new URL(request.url);

  // `/` is the marketing root: visitors land on the public landing page.
  if (url.pathname === '/' || url.pathname === '') {
    return Response.redirect(new URL('/landing', url), 307);
  }

  // Un-prefixed app entry (/app) → default locale app shell.
  if (url.pathname === '/app' || url.pathname === '/app/') {
    return Response.redirect(new URL('/fa/app', url), 307);
  }

  // Bare locale prefix (/fa, /en) → the app shell inside that locale.
  if (url.pathname === '/fa' || url.pathname === '/fa/' || url.pathname === '/en' || url.pathname === '/en/') {
    const locale = url.pathname.startsWith('/fa') ? 'fa' : 'en';
    return Response.redirect(new URL(`/${locale}/app`, url), 307);
  }

  return intlMiddleware(request);
}

export const config = {
  // Everything except API routes, Next internals, files with an extension and the
  // public standalone pages (`/landing`, `/docs`) which live outside the locale router.
  matcher: '/((?!api|_next|_vercel|landing|docs|.*\\..*).*)',
};
