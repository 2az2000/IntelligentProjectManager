import type { ProjectStatus } from '../types';

/**
 * The four columns every project starts with. They are translated by key (Tasks.status.*), so a
 * renamed built-in still reads in the user's own language; custom columns show their own label.
 */
export const BUILTIN_STATUS_KEYS = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;

export const isBuiltinStatusKey = (key: string): boolean =>
  (BUILTIN_STATUS_KEYS as readonly string[]).includes(key);

/**
 * Rendered while the vocabulary request is in flight (or fails) so the board and the status
 * selects never collapse into an empty shell. Mirrors DEFAULT_STATUSES on the server.
 */
export const FALLBACK_STATUSES: ProjectStatus[] = [
  { id: -1, key: 'TODO', label: 'To Do', color: '#64748b', category: 'TODO', position: 1024 },
  { id: -2, key: 'IN_PROGRESS', label: 'In Progress', color: '#2563eb', category: 'IN_PROGRESS', position: 2048 },
  { id: -3, key: 'REVIEW', label: 'Review', color: '#a855f7', category: 'REVIEW', position: 3072 },
  { id: -4, key: 'DONE', label: 'Done', color: '#16a34a', category: 'DONE', position: 4096 },
];

/** Board order. The API already sorts, but optimistic patches must not shuffle the columns. */
export const sortStatuses = <T extends { position: number }>(statuses: T[]): T[] =>
  [...statuses].sort((a, b) => a.position - b.position);

export const statusByKey = (
  statuses: ProjectStatus[] | undefined,
  key: string,
): ProjectStatus | undefined => statuses?.find((status) => status.key === key);

/** The next column after `key` — the default target when tasks have to be moved off a column. */
export const nextStatus = (
  statuses: ProjectStatus[],
  key: string,
): ProjectStatus | undefined => {
  const sorted = sortStatuses(statuses);
  const index = sorted.findIndex((status) => status.key === key);
  return sorted[index + 1] ?? sorted[index - 1];
};
