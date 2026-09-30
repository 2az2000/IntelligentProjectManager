import { hasRole, type ProjectRole } from './project-role';

export type MembershipDenial =
  | 'CANNOT_MANAGE_OWNER'
  | 'CANNOT_GRANT_OWNER'
  | 'ONLY_OWNER_MANAGES_ADMINS'
  | 'INSUFFICIENT_ROLE';

/**
 * Who may add, re-role or remove a member. Pure policy — no I/O.
 * - Nobody changes or removes the OWNER, and OWNER is never granted (ownership transfer is separate).
 * - ADMIN+ manages members; only the OWNER grants/revokes ADMIN or touches existing admins.
 * - Anyone except the owner may remove themselves (leave the project).
 */
export function checkMembershipChange(input: {
  actorRole: ProjectRole;
  actorIsTarget: boolean;
  targetRole: ProjectRole | null; // null when adding a new member
  newRole: ProjectRole | null; // null when removing
}): MembershipDenial | null {
  const { actorRole, actorIsTarget, targetRole, newRole } = input;

  if (targetRole === 'OWNER') return 'CANNOT_MANAGE_OWNER';
  if (newRole === 'OWNER') return 'CANNOT_GRANT_OWNER';
  if (newRole === null && actorIsTarget) return null; // leaving

  if (!hasRole(actorRole, 'ADMIN')) return 'INSUFFICIENT_ROLE';
  const touchesAdmin = targetRole === 'ADMIN' || newRole === 'ADMIN';
  if (touchesAdmin && actorRole !== 'OWNER') return 'ONLY_OWNER_MANAGES_ADMINS';
  return null;
}
