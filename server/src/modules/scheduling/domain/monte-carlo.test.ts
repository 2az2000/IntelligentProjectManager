import { describe, expect, it } from 'vitest';
import { probabilityWithin, runMonteCarlo, DEFAULT_MC_CONFIG } from './monte-carlo';

/** Deterministic fake CPM: duration = sum of all node durations, everyone critical. */
const fakeCpm = (nodes: { id: number; duration: number }[]) => ({
  projectDuration: nodes.reduce((acc, n) => acc + n.duration, 0),
  criticalPath: nodes.map((n) => n.id),
});

describe('runMonteCarlo', () => {
  const tasks = [
    { id: 1, estimateHours: 10, status: 'TODO' },
    { id: 2, estimateHours: null, status: 'TODO' },
    { id: 3, estimateHours: 4, status: 'DONE' },
  ];

  it('uses the triangular bounds (min 0.75x, max 1.5x) — samples stay inside', () => {
    const result = runMonteCarlo(tasks, [], fakeCpm, { runs: 500 });
    // With a null-estimate fallback = 10 (median of {10}), total max = 10*1.5 + 10 = 25, min = 7.5.
    for (const s of result.samples) {
      expect(s).toBeGreaterThanOrEqual(DEFAULT_MC_CONFIG.optimisticFactor * 10 - 1e-9);
      expect(s).toBeLessThanOrEqual(10 * DEFAULT_MC_CONFIG.pessimisticFactor + 10 + 1e-9);
    }
  });

  it('DONE tasks contribute zero; criticality reflects what the CPM engine reports', () => {
    // Fake engine returns every node as critical — including DONE ones. That is the
    // engine's answer, and monte-carlo mirrors it faithfully.
    const result = runMonteCarlo(tasks, [], fakeCpm, { runs: 200 });
    expect(result.criticality.get(3)).toBeCloseTo(1, 5);
    expect(result.criticality.get(1)).toBeCloseTo(1, 5);
    expect(result.criticality.get(2)).toBeCloseTo(1, 5);
    // The mean sampled duration of the DONE task is exactly zero though.
    expect(result.meanDuration.get(3)).toBe(0);
  });

  it('percentiles are ordered p50 <= p85 <= p95', () => {
    const result = runMonteCarlo(tasks, [], fakeCpm, { runs: 1000 });
    expect(result.p50).toBeLessThanOrEqual(result.p85);
    expect(result.p85).toBeLessThanOrEqual(result.p95);
    expect(result.runs).toBe(1000);
  });

  it('unestimated tasks fall back to the median of estimated ones', () => {
    const result = runMonteCarlo(
      [
        { id: 1, estimateHours: 4, status: 'TODO' },
        { id: 2, estimateHours: null, status: 'TODO' },
      ],
      [],
      fakeCpm,
      { runs: 100 },
    );
    // fallback = 4 → total between 3 and 4+6=10.
    expect(result.p50).toBeGreaterThan(2);
    expect(result.p50).toBeLessThan(11);
  });

  it('probabilityWithin counts the in-time share', () => {
    expect(probabilityWithin([1, 2, 3, 4], 2)).toBe(0.5);
    expect(probabilityWithin([], 5)).toBe(0);
  });
});
