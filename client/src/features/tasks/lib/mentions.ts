import type { UserSummary } from '../types';

export interface MentionHit {
  /** Index of the `@` that opens the mention. */
  start: number;
  /** What has been typed after `@` so far (may contain spaces — member names do). */
  query: string;
}

const MAX_QUERY = 40;

/**
 * The `@` query ending at the caret, or null.
 *
 * A mention only starts after whitespace (or at the very beginning) and stops at a newline or a
 * second `@` — otherwise editing earlier text would keep reopening a stale dropdown. Spaced names
 * are supported on purpose: the server matches `@Full Name` literally.
 */
export function mentionQuery(value: string, caret: number): MentionHit | null {
  const before = value.slice(0, Math.max(0, Math.min(caret, value.length)));
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1]!)) return null;
  const query = before.slice(at + 1);
  if (query.length > MAX_QUERY || /[\n@]/.test(query)) return null;
  return { start: at, query };
}

/** Case-insensitive name match; an empty query offers the whole team. */
export function filterMentionCandidates(
  members: UserSummary[],
  query: string,
  limit = 6,
): UserSummary[] {
  const needle = query.trim().toLowerCase();
  return members
    .filter((member) => member.name.toLowerCase().includes(needle))
    .slice(0, limit);
}

/**
 * Replaces the active `@query` with `@Name ` and returns where the caret belongs.
 *
 * The result is a plain mention in the stored body — no ids or markup — which is exactly what the
 * server's mention parser and the notification fan-out expect.
 */
export function applyMention(
  value: string,
  hit: MentionHit,
  member: UserSummary,
): { value: string; caret: number } {
  const before = value.slice(0, hit.start);
  const after = value.slice(hit.start + 1 + hit.query.length);
  const inserted = `@${member.name} ${after}`;
  return { value: `${before}${inserted}`, caret: before.length + member.name.length + 2 };
}
