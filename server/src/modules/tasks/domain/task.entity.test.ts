import { describe, expect, it } from 'vitest';
import { Task, type TaskProps } from './task.entity';

const now = new Date('2026-09-28T10:00:00Z');

const base: TaskProps = {
  id: 1,
  projectId: 1,
  parentId: null,
  title: 'Task',
  description: null,
  status: 'TODO',
  priority: 'MEDIUM',
  position: 1024,
  tags: [],
  points: null,
  startDate: null,
  dueDate: null,
  completedAt: null,
  authorId: 1,
  assigneeId: null,
  deletedAt: null,
  createdAt: now,
  updatedAt: now,
};

describe('Task', () => {
  it('validates new tasks and derives completedAt', () => {
    const t = Task.validateNew(
      { projectId: 1, authorId: 1, title: '  Do it ', status: 'DONE', tags: [' a', 'a', 'b '] },
      2048,
      now,
    );
    expect(t).toMatchObject({ title: 'Do it', completedAt: now, tags: ['a', 'b'], position: 2048 });
    expect(() => Task.validateNew({ projectId: 1, authorId: 1, title: '  ' }, 0, now)).toThrow();
  });

  it('sets and clears completedAt when the status changes', () => {
    const task = Task.restore({ ...base });
    expect(task.applyChanges({ status: 'DONE' }, now)).toMatchObject({ completedAt: now });
    expect(task.applyChanges({ status: 'IN_PROGRESS' }, now)).toMatchObject({ completedAt: null });
    expect(task.applyChanges({ priority: 'HIGH' }, now)).not.toHaveProperty('completedAt');
  });

  it('rejects start after due, considering existing values', () => {
    const task = Task.restore({ ...base, dueDate: new Date('2026-01-01') });
    expect(() => task.applyChanges({ startDate: new Date('2026-02-01') }, now)).toThrow();
  });

  it('knows when it is overdue', () => {
    expect(Task.restore({ ...base, dueDate: new Date('2026-01-01') }).isOverdue(now)).toBe(true);
    expect(
      Task.restore({ ...base, dueDate: new Date('2026-01-01'), status: 'DONE' }).isOverdue(now),
    ).toBe(false);
  });
});
