import { describe, expect, it } from 'vitest';
import { hasRole } from '../types';

describe('hasRole (VIEWER < MEMBER < ADMIN < OWNER)', () => {
  it.each([
    ['VIEWER', 'VIEWER', true],
    ['VIEWER', 'MEMBER', false],
    ['MEMBER', 'VIEWER', true],
    ['MEMBER', 'MEMBER', true],
    ['MEMBER', 'ADMIN', false],
    ['ADMIN', 'MEMBER', true],
    ['ADMIN', 'ADMIN', true],
    ['ADMIN', 'OWNER', false],
    ['OWNER', 'ADMIN', true],
    ['OWNER', 'OWNER', true],
  ] as const)('%s requiring %s ⇒ %s', (actual, required, expected) => {
    expect(hasRole(actual, required)).toBe(expected);
  });
});
