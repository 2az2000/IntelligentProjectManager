import { describe, expect, it } from 'vitest';
import { checkMembershipChange } from './membership-rules';

describe('checkMembershipChange', () => {
  it('protects the owner', () => {
    expect(
      checkMembershipChange({ actorRole: 'OWNER', actorIsTarget: true, targetRole: 'OWNER', newRole: null }),
    ).toBe('CANNOT_MANAGE_OWNER');
    expect(
      checkMembershipChange({ actorRole: 'OWNER', actorIsTarget: false, targetRole: null, newRole: 'OWNER' }),
    ).toBe('CANNOT_GRANT_OWNER');
  });

  it('lets admins manage members but not admins', () => {
    const admin = { actorRole: 'ADMIN' as const, actorIsTarget: false };
    expect(checkMembershipChange({ ...admin, targetRole: null, newRole: 'MEMBER' })).toBeNull();
    expect(checkMembershipChange({ ...admin, targetRole: 'MEMBER', newRole: 'VIEWER' })).toBeNull();
    expect(checkMembershipChange({ ...admin, targetRole: 'MEMBER', newRole: 'ADMIN' })).toBe(
      'ONLY_OWNER_MANAGES_ADMINS',
    );
    expect(checkMembershipChange({ ...admin, targetRole: 'ADMIN', newRole: null })).toBe(
      'ONLY_OWNER_MANAGES_ADMINS',
    );
  });

  it('lets the owner promote admins and members leave', () => {
    expect(
      checkMembershipChange({ actorRole: 'OWNER', actorIsTarget: false, targetRole: 'MEMBER', newRole: 'ADMIN' }),
    ).toBeNull();
    expect(
      checkMembershipChange({ actorRole: 'VIEWER', actorIsTarget: true, targetRole: 'VIEWER', newRole: null }),
    ).toBeNull();
    expect(
      checkMembershipChange({ actorRole: 'MEMBER', actorIsTarget: false, targetRole: null, newRole: 'VIEWER' }),
    ).toBe('INSUFFICIENT_ROLE');
  });
});
