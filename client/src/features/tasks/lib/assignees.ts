import type { UserSummary } from '../types';

/**
 * The assignee set is ordered: index 0 is the lead (مسئول اصلی) and the rest are co-assignees.
 * Every helper here preserves that invariant, so what the picker shows and what
 * `PATCH { assigneeIds }` stores can never drift apart.
 */
export const toAssigneeIds = (assignees: UserSummary[]): number[] => assignees.map((u) => u.id);

/** Adds or removes one person. Removing the lead promotes whoever is next in line. */
export function toggleAssignee(current: number[], userId: number, checked: boolean): number[] {
  if (!checked) return current.filter((id) => id !== userId);
  return current.includes(userId) ? current : [...current, userId];
}

/** Moves an existing assignee to the front — the king-making action of the picker. */
export function promoteAssignee(current: number[], userId: number): number[] {
  if (!current.includes(userId) || current[0] === userId) return current;
  return [userId, ...current.filter((id) => id !== userId)];
}

export const isLeadAssignee = (current: number[], userId: number): boolean => current[0] === userId;

/** Everyone on the task except the lead. */
export const coAssigneeCount = (current: number[]): number => Math.max(0, current.length - 1);

/**
 * Sends only well-formed ids: the API validates membership, but dropping ids it would reject
 * anyway (a member removed from the project while the board is open) keeps the picker honest.
 */
export const knownAssignees = (current: number[], members: UserSummary[]): number[] => {
  const known = new Set(members.map((m) => m.id));
  return current.filter((id) => known.has(id));
};
