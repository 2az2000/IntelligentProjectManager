import { describe, expect, it } from 'vitest';
import { aggregateWorkload, buildWeeks, spreadAcrossWeeks, weekStart } from './workload';

// Fixed clock: Wednesday 2026-10-14 12:00 local.
const NOW = new Date(2026, 9, 14, 12, 0);
const SAT = new Date(2026, 9, 10); // the Saturday that opens the current week
const DAY = 24 * 60 * 60 * 1000;

describe('weekStart', () => {
  it('snaps to the Saturday at/before the date', () => {
    // Wed 14 → Sat 10; Sun 11 → Sat 10; Sat 10 → Sat 10.
    expect(weekStart(new Date(2026, 9, 14)).getTime()).toBe(SAT.getTime());
    expect(weekStart(new Date(2026, 9, 11)).getTime()).toBe(SAT.getTime());
    expect(weekStart(new Date(2026, 9, 10)).getTime()).toBe(SAT.getTime());
  });
});

describe('spreadAcrossWeeks', () => {
  it('spreads an estimate proportionally over the weeks the task spans', () => {
    const weeks = buildWeeks(SAT, 5);
    // Window [Wed 12:00, +21d]: W0 keeps only Sat-bound 2.5 of 21 days, W1/W2 get full weeks,
    // W3 gets the remaining 4.5 days.
    const shares = spreadAcrossWeeks(NOW, new Date(NOW.getTime() + 21 * DAY), 30, weeks, NOW);
    expect(shares[0]).toBeCloseTo(30 * (2.5 / 21), 5);
    expect(shares[1]).toBeCloseTo(10);
    expect(shares[2]).toBeCloseTo(10);
    expect(shares[3]).toBeCloseTo(30 * (4.5 / 21), 5);
    expect(shares[4]).toBeCloseTo(0);
    expect(shares.reduce((s, h) => s + h, 0)).toBeCloseTo(30);
  });

  it('keeps overdue open work pressing on the current week', () => {
    const weeks = buildWeeks(SAT, 3);
    // Started 2 weeks ago, due last week, still open → clamped to [now, now] → current week.
    const shares = spreadAcrossWeeks(
      new Date(SAT.getTime() - 14 * DAY),
      new Date(SAT.getTime() + 3 * DAY),
      8,
      weeks,
      NOW,
    );
    expect(shares[0]).toBe(8);
    expect(shares[1]).toBe(0);
  });

  it('dots an undated task entirely into its containing week', () => {
    const weeks = buildWeeks(SAT, 2);
    const shares = spreadAcrossWeeks(NOW, NOW, 5, weeks, NOW);
    expect(shares[0]).toBe(5);
    expect(shares[1]).toBe(0);
  });
});

describe('aggregateWorkload', () => {
  const weeks = buildWeeks(SAT, 2);
  const task = (id: number, patch: Partial<Parameters<typeof aggregateWorkload>[0][number]> = {}) => ({
    id,
    title: `Task ${id}`,
    projectId: 1,
    projectName: 'P',
    assigneeId: null,
    collaboratorIds: [],
    startDate: null,
    dueDate: null,
    estimateHours: null,
    createdAt: SAT,
    ...patch,
  });

  it('books undated work in the current week and dated work in its weeks', () => {
    const result = aggregateWorkload(
      [
        task(1, { estimateHours: 10, assigneeId: 7 }),
        // Starts at next Saturday's midnight, due in 2 full weeks → exactly 10h in W1 and W2.
        task(2, {
          estimateHours: 20,
          assigneeId: 7,
          startDate: new Date(SAT.getTime() + 7 * DAY),
          dueDate: new Date(SAT.getTime() + 21 * DAY),
        }),
      ],
      [{ id: 7 }],
      weeks,
      NOW,
    );
    expect(result.get(7)!.hours).toEqual([10, 10]); // W0 undated + W1 share (3rd week not requested)
    expect(result.get(7)!.tasks[0]!.map((t) => t.id)).toEqual([1]); // undated burns now
    expect(result.get(7)!.tasks[1]!.map((t) => t.id)).toEqual([2]);
  });

  it('credits every assignee in full and ignores non-members', () => {
    const result = aggregateWorkload(
      [task(1, { estimateHours: 10, assigneeId: 7, collaboratorIds: [8] })],
      [{ id: 7 }, { id: 8 }],
      weeks,
      NOW,
    );
    expect(result.get(7)!.hours[0]).toBe(10);
    expect(result.get(8)!.hours[0]).toBe(10);
    expect(result.get(9)).toBeUndefined();
  });
});
