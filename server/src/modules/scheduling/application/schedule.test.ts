import { describe, expect, it } from 'vitest';
import { buildSchedule, type ScheduleEdge, type ScheduleTask } from './schedule';

const task = (over: Partial<ScheduleTask> & { id: number }): ScheduleTask => ({
  title: `Task ${over.id}`,
  status: 'TODO',
  estimateHours: null,
  startDate: null,
  dueDate: null,
  ...over,
});

const edge = (predecessorId: number, successorId: number): ScheduleEdge => ({
  predecessorId,
  successorId,
});

describe('buildSchedule', () => {
  it('computes CPM timings over a dependency chain', () => {
    // A(8h) → B(16h) → C(4h): chain A→B→C is critical.
    const res = buildSchedule(
      [
        task({ id: 1, estimateHours: 8 }),
        task({ id: 2, estimateHours: 16 }),
        task({ id: 3, estimateHours: 4 }),
        task({ id: 4, estimateHours: 8 }),
      ],
      [edge(1, 2), edge(2, 3), edge(1, 4)],
    );

    expect(res.projectDurationHours).toBe(28);
    expect(res.criticalPath).toEqual([1, 2, 3]);
    const [a, b, c, d] = res.tasks;

    expect(a).toMatchObject({ earliestStart: 0, slack: 0, isCritical: true });
    expect(b).toMatchObject({ earliestStart: 8, slack: 0, isCritical: true });
    expect(c).toMatchObject({ earliestStart: 24, slack: 0, isCritical: true });
    // D runs parallel to B+C: it finishes at 16 and can slide 12h (28 − 16) before delaying the project.
    expect(d).toMatchObject({ earliestStart: 8, slack: 12, isCritical: false });
  });

  it('treats finished tasks as zero-duration and excludes them from criticality', () => {
    const res = buildSchedule(
      [task({ id: 1, status: 'DONE', estimateHours: 8 }), task({ id: 2, estimateHours: 8 })],
      [edge(1, 2)],
    );
    expect(res.projectDurationHours).toBe(8);
    expect(res.tasks[0]).toMatchObject({ slack: 0, isCritical: false });
    expect(res.tasks[1]).toMatchObject({ earliestStart: 0, isCritical: true });
  });

  it('passes unestimated tasks through the graph with zero duration but flags them', () => {
    const res = buildSchedule(
      [task({ id: 1, estimateHours: 8 }), task({ id: 2 }), task({ id: 3, estimateHours: 4 })],
      [edge(1, 2), edge(2, 3)],
    );
    const unestimated = res.tasks.find((t) => t.id === 2)!;
    expect(unestimated.earliestStart).toBeNull();
    expect(unestimated.isCritical).toBe(false);
    expect(res.unestimatedTaskIds).toEqual([2]);
  });

  it('shifts the schedule by a manual startDate and computes scheduledFinish', () => {
    const start = '2026-10-04T08:00:00.000Z';
    const res = buildSchedule(
      [
        task({ id: 1, estimateHours: 4, startDate: start }),
        task({ id: 2, estimateHours: 2, startDate: start }),
      ],
      [edge(1, 2)],
    );
    const a = res.tasks[0]!;
    const b = res.tasks[1]!;
    expect(a.scheduledStart).toBe(start);
    expect(a.scheduledFinish).toBe('2026-10-04T12:00:00.000Z');
    expect(b.scheduledStart).toBe('2026-10-04T12:00:00.000Z');
    expect(b.scheduledFinish).toBe('2026-10-04T14:00:00.000Z');
  });

  it('ignores edges that reference tasks outside the set', () => {
    const res = buildSchedule([task({ id: 1, estimateHours: 8 })], [edge(1, 99), edge(99, 1)]);
    expect(res.tasks[0]).toMatchObject({ earliestStart: 0, earliestFinish: 8 });
    expect(res.criticalPath).toEqual([1]);
  });
});
