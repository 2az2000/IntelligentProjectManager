import { describe, expect, it } from 'vitest';
import type { ScheduleEdge, ScheduleTask } from '../application/schedule';
import { findDependencyDateConflicts } from './date-conflicts';

const iso = (day: number) => new Date(Date.UTC(2026, 0, day)).toISOString();

const task = (
  id: number,
  dates: { start?: number; due?: number } = {},
  status: ScheduleTask['status'] = 'TODO',
): ScheduleTask => ({
  id,
  title: `Task ${id}`,
  status,
  estimateHours: null,
  startDate: dates.start ? iso(dates.start) : null,
  dueDate: dates.due ? iso(dates.due) : null,
});

const edge = (predecessorId: number, successorId: number): ScheduleEdge => ({
  predecessorId,
  successorId,
});

const find = (input: {
  taskId: number;
  tasks: ScheduleTask[];
  deps: ScheduleEdge[];
  limit?: number;
}) => findDependencyDateConflicts(input);

describe('findDependencyDateConflicts', () => {
  it('flags a successor that starts before its predecessor finishes', () => {
    const tasks = [task(1, { due: 20 }), task(2, { start: 10 })];
    const conflicts = find({ taskId: 2, tasks, deps: [edge(1, 2)] });

    expect(conflicts).toEqual([
      {
        code: 'DEPENDENCY_DATE_CONFLICT',
        direction: 'predecessor',
        relatedTaskId: 1,
        relatedTaskTitle: 'Task 1',
        conflictDays: 10,
      },
    ]);
  });

  it('treats a same-day hand-off as valid (finish-to-start has no required gap)', () => {
    const tasks = [task(1, { due: 10 }), task(2, { start: 10 })];
    expect(find({ taskId: 2, tasks, deps: [edge(1, 2)] })).toEqual([]);
    // …and the other direction: due on the successor's start day is fine too.
    const other = [task(1, { due: 10 }), task(2, { start: 10 })];
    expect(find({ taskId: 1, tasks: other, deps: [edge(1, 2)] })).toEqual([]);
  });

  it('flags a task whose due date is later than a dependent task’s start', () => {
    const tasks = [task(1, { due: 20 }), task(2, { start: 10 })];
    const conflicts = find({ taskId: 1, tasks, deps: [edge(1, 2)] });

    expect(conflicts).toMatchObject([
      { direction: 'successor', relatedTaskId: 2, relatedTaskTitle: 'Task 2', conflictDays: 10 },
    ]);
  });

  it('sees through a chain that carries no dates of its own', () => {
    const tasks = [
      task(1, { due: 20 }, 'IN_PROGRESS'),
      task(2),
      task(3, { start: 10 }),
    ];
    const deps = [edge(1, 2), edge(2, 3)];
    const conflicts = find({ taskId: 3, tasks, deps });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ relatedTaskId: 1, direction: 'predecessor', conflictDays: 10 });
  });

  it('ignores finished tasks on both sides of the edit', () => {
    // A DONE predecessor no longer constrains anything.
    expect(
      find({ taskId: 2, tasks: [task(1, { due: 20 }, 'DONE'), task(2, { start: 10 })], deps: [edge(1, 2)] }),
    ).toEqual([]);
    // A DONE task being edited is history too.
    expect(
      find({ taskId: 2, tasks: [task(1, { due: 20 }), task(2, { start: 10 }, 'DONE')], deps: [edge(1, 2)] }),
    ).toEqual([]);
  });

  it('returns the most severe conflicts first, capped by the limit', () => {
    const tasks = [
      task(1, { due: 30 }),
      task(2, { due: 20 }),
      task(3, { due: 15 }),
      task(4, { start: 10 }),
    ];
    const deps = [edge(1, 4), edge(2, 4), edge(3, 4)];
    const conflicts = find({ taskId: 4, tasks, deps, limit: 2 });

    expect(conflicts.map((c) => [c.relatedTaskId, c.conflictDays])).toEqual([
      [1, 20],
      [2, 10],
    ]);
  });

  it('does not duplicate a conflict across two paths to the same task', () => {
    const tasks = [task(1, { due: 20 }), task(2), task(3, { start: 10 })];
    // 1 → 2 → 3 and 1 → 3: task 1 is reachable twice.
    const conflicts = find({ taskId: 3, tasks, deps: [edge(1, 2), edge(2, 3), edge(1, 3)] });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.relatedTaskId).toBe(1);
  });
});
