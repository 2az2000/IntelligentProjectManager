import { describe, expect, it } from 'vitest';
import {
  coAssigneeCount,
  isLeadAssignee,
  knownAssignees,
  promoteAssignee,
  toAssigneeIds,
  toggleAssignee,
} from './assignees';
import { sara } from '@/test/handlers';

const admin = { id: 1, name: 'مدیر سیستم', avatarUrl: null };
const reza = { id: 3, name: 'رضا محمدی', avatarUrl: null };

describe('assignee set helpers', () => {
  it('reads the ordered ids of a task', () => {
    expect(toAssigneeIds([admin, reza])).toEqual([1, 3]);
    expect(toAssigneeIds([])).toEqual([]);
  });

  it('appends a new co-assignee without touching the lead', () => {
    expect(toggleAssignee([1], 3, true)).toEqual([1, 3]);
    // Selecting someone already on the task is a no-op, never a duplicate.
    expect(toggleAssignee([1, 3], 3, true)).toEqual([1, 3]);
  });

  it('promotes the next in line when the lead is removed', () => {
    expect(toggleAssignee([1, 3], 1, false)).toEqual([3]);
    expect(isLeadAssignee(toggleAssignee([1, 3], 1, false), 3)).toBe(true);
    expect(toggleAssignee([1], 1, false)).toEqual([]);
  });

  it('moves an existing assignee to the lead slot', () => {
    expect(promoteAssignee([1, 3], 3)).toEqual([3, 1]);
    expect(promoteAssignee([1, 3], 1)).toEqual([1, 3]);
    // Someone who is not assigned cannot become lead by accident.
    expect(promoteAssignee([1], 3)).toEqual([1]);
  });

  it('counts everyone except the lead', () => {
    expect(coAssigneeCount([])).toBe(0);
    expect(coAssigneeCount([1])).toBe(0);
    expect(coAssigneeCount([1, 3])).toBe(1);
  });

  it('drops ids of people who are no longer project members', () => {
    expect(knownAssignees([1, 3, 99], [admin, reza])).toEqual([1, 3]);
    expect(knownAssignees([sara.id], [admin])).toEqual([]);
  });
});
