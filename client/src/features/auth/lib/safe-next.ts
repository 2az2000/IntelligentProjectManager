/** Only allow same-app relative paths as post-login redirect targets (no open redirects). */
export function safeNextPath(next: string | null | undefined): string {
  const fallback = '/app/dashboard';
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
