import { describe, expect, it } from 'vitest';
import type { ScheduledTask } from '../types';
import { buildDependencyArrows, buildTimelineLayout, predictedFinish } from './timeline';

const task = (overrides: Partial<ScheduledTask>): ScheduledTask => ({
  id: 0,
  title: '',
  status: 'TODO',
  estimateHours: null,
  startDate: null,
  dueDate: null,
  earliestStart: null,
  earliestFinish: null,
  latestStart: null,
  latestFinish: null,
  slack: null,
  isCritical: false,
  scheduledStart: null,
  scheduledFinish: null,
  ...overrides,
});

describe('buildTimelineLayout', () => {
  it('positions bars on a common hour scale and flags rows without estimates', () => {
    const { rows, totalHours } = buildTimelineLayout([
      task({ id: 2, title: 'B', estimateHours: 12, earliestStart: 16, earliestFinish: 28, slack: 0, isCritical: true }),
      task({ id: 1, title: 'A', estimateHours: 16, earliestStart: 0, earliestFinish: 16, slack: 0, isCritical: true }),
      task({ id: 3, title: 'D', estimateHours: 8, earliestStart: 0, earliestFinish: 8, slack: 56 }),
      task({ id: 4, title: 'E', estimateHours: null }),
    ]);

    expect(totalHours).toBe(28);
    // Sorted by earliest start then id: A and D both start at 0, B at 16, unestimated last.
    expect(rows.map((r) => r.task.id)).toEqual([1, 3, 2, 4]);

    const a = rows[0]!;
    expect(a.hasBar).toBe(true);
    expect(a.leftPct).toBeCloseTo(0);
    expect(a.widthPct).toBeCloseTo((16 / 28) * 100, 5);

    const d = rows[1]!;
    expect(d.leftPct).toBeCloseTo(0);
    expect(d.slackPct).toBeCloseTo((56 / 28) * 100, 5); // long slack tail

    const b = rows[2]!;
    expect(b.leftPct).toBeCloseTo((16 / 28) * 100, 5);
    expect(b.slackPct).toBe(0); // critical ⇒ no slack segment

    const e = rows[3]!;
    expect(e.hasBar).toBe(false);
    expect(e.widthPct).toBe(0);
    expect(e.slackPct).toBe(0);
  });

  it('never produces a zero or negative scale', () => {
    const { totalHours } = buildTimelineLayout([task({ id: 1, title: 'X', estimateHours: null })]);
    expect(totalHours).toBe(1);
  });

  it('gives tiny bars a minimum width so they stay clickable', () => {
    const { rows, totalHours } = buildTimelineLayout([
      task({ id: 1, title: 'Small', estimateHours: 0.01, earliestStart: 0, earliestFinish: 0.01, slack: 0 }),
    ]);
    expect((0.01 / totalHours) * 100).toBeLessThan(1.5);
    expect(rows[0]!.widthPct).toBe(1.5);
  });
});

describe('buildDependencyArrows', () => {
  const layout = buildTimelineLayout([
    task({ id: 1, title: 'A', estimateHours: 16, earliestStart: 0, earliestFinish: 16 }),
    task({ id: 2, title: 'B', estimateHours: 12, earliestStart: 16, earliestFinish: 28 }),
    task({ id: 3, title: 'E', estimateHours: null }), // no bar ⇒ arrows touching it are dropped
  ]);

  it('maps finish-to-start edges to arrow coordinates', () => {
    const arrows = buildDependencyArrows(layout, [{ predecessorId: 1, successorId: 2 }]);
    expect(arrows).toHaveLength(1);
    // A finishes exactly where B starts (16 h on the 28 h scale).
    expect(arrows[0]).toMatchObject({
      x1: (16 / 28) * 100,
      x2: (16 / 28) * 100,
      fromRow: 0,
      toRow: 1,
    });
  });

  it('skips edges anchored on unestimated tasks', () => {
    const arrows = buildDependencyArrows(layout, [
      { predecessorId: 2, successorId: 3 },
      { predecessorId: 3, successorId: 1 },
      { predecessorId: 99, successorId: 1 },
    ]);
    expect(arrows).toHaveLength(0);
  });
});

describe('predictedFinish', () => {
  it('prefers the latest scheduled task finish', () => {
    const anchor = new Date('2026-10-01T08:00:00.000Z');
    const finish = predictedFinish(
      {
        tasks: [
          task({ id: 1, estimateHours: 4, scheduledFinish: '2026-10-02T12:00:00.000Z' }),
          task({ id: 2, estimateHours: 8, scheduledFinish: '2026-10-05T16:00:00.000Z' }),
        ],
        projectDurationHours: 12,
      },
      anchor,
    );
    expect(finish.toISOString()).toBe('2026-10-05T16:00:00.000Z');
  });

  it('falls back to anchor + project duration without scheduled dates', () => {
    const anchor = new Date('2026-10-01T08:00:00.000Z');
    const finish = predictedFinish({ tasks: [], projectDurationHours: 24 }, anchor);
    expect(finish.toISOString()).toBe('2026-10-02T08:00:00.000Z');
  });
});
