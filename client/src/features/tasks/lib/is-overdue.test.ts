import { describe, expect, it } from 'vitest';
import { isOverdue } from '../types';

describe('isOverdue', () => {
  const yesterday = '2026-09-29T00:00:00.000Z';
  const tomorrow = '2026-10-01T00:00:00.000Z';

  it('flags open tasks with a past due date', () => {
    expect(isOverdue({ dueDate: yesterday, status: 'TODO' })).toBe(true);
  });

  it('never flags done tasks', () => {
    expect(isOverdue({ dueDate: yesterday, status: 'DONE' })).toBe(false);
  });

  it('does not flag future due dates', () => {
    expect(isOverdue({ dueDate: tomorrow, status: 'IN_PROGRESS' })).toBe(false);
  });

  it('returns false without a due date', () => {
    expect(isOverdue({ dueDate: null, status: 'TODO' })).toBe(false);
  });
});
