import { describe, expect, it } from 'vitest';
import { isOverdue } from '../types';

describe('isOverdue', () => {
  // Relative to the clock — hard-coded dates go stale as real time passes.
  const DAY = 24 * 60 * 60 * 1000;
  const yesterday = new Date(Date.now() - DAY).toISOString();
  const tomorrow = new Date(Date.now() + DAY).toISOString();

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
