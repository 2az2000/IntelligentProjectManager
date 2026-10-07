import { describe, expect, it } from 'vitest';
import { computeRiskScore, computeRiskScores, DEFAULT_RISK_WEIGHTS } from './risk-score';

const now = new Date('2026-10-07T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

const base = {
  id: 1,
  status: 'IN_PROGRESS',
  priority: 'MEDIUM' as const,
  dueDate: null,
  estimateHours: 8,
  slack: null,
  isCritical: false,
  daysSinceUpdate: 0,
  assigneeOpenHours: null,
  assigneeCapacityHours: null,
};

describe('computeRiskScore', () => {
  it('DONE tasks always score 0', () => {
    expect(computeRiskScore({ ...base, status: 'DONE' }, now)).toBe(0);
  });

  it('overdue dominates due-soon', () => {
    const overdue = computeRiskScore({ ...base, dueDate: daysAgo(3) }, now);
    const dueSoon = computeRiskScore({ ...base, dueDate: new Date(now.getTime() + 24 * 60 * 60 * 1000) }, now);
    expect(overdue).toBeGreaterThan(dueSoon);
    expect(overdue).toBeGreaterThanOrEqual(DEFAULT_RISK_WEIGHTS.overdue);
  });

  it('critical + urgent accumulates', () => {
    const score = computeRiskScore(
      { ...base, isCritical: true, priority: 'URGENT', dueDate: null },
      now,
    );
    expect(score).toBe(DEFAULT_RISK_WEIGHTS.critical + 12 + DEFAULT_RISK_WEIGHTS.noDueDate);
  });

  it('stale days add up to the cap', () => {
    const stale = computeRiskScore({ ...base, daysSinceUpdate: 40 }, now);
    expect(stale).toBeLessThanOrEqual(DEFAULT_RISK_WEIGHTS.staleCap + DEFAULT_RISK_WEIGHTS.noDueDate);
  });

  it('over-allocated assignee is flagged', () => {
    const score = computeRiskScore(
      { ...base, assigneeOpenHours: 50, assigneeCapacityHours: 40 },
      now,
    );
    expect(score).toBeGreaterThanOrEqual(DEFAULT_RISK_WEIGHTS.overAllocation + DEFAULT_RISK_WEIGHTS.noDueDate);
  });

  it('scores clamp to [0, 100]', () => {
    const extreme = computeRiskScore(
      {
        ...base,
        priority: 'URGENT',
        dueDate: daysAgo(30),
        isCritical: true,
        daysSinceUpdate: 90,
        assigneeOpenHours: 100,
        assigneeCapacityHours: 10,
        slack: -100,
      },
      now,
    );
    expect(extreme).toBeLessThanOrEqual(100);
  });
});

describe('computeRiskScores', () => {
  it('sorts worst-first and carries explainable reasons', () => {
    const results = computeRiskScores(
      [
        { ...base, id: 2 },
        { ...base, id: 1, overdue: undefined, dueDate: daysAgo(5) } as never,
      ],
      now,
    );
    expect(results[0]!.taskId).toBe(1);
    expect(results[0]!.reasons).toContain('overdue');
  });
});
