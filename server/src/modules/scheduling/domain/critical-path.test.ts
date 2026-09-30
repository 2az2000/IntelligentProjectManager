import { describe, expect, it } from 'vitest';
import { calculateCriticalPath, type ScheduleNode } from './critical-path';
import { DependencyCycleError } from './dependency-resolver';

describe('calculateCriticalPath', () => {
  const nodes: ScheduleNode<string>[] = [
    { id: 'A', duration: 3 },
    { id: 'B', duration: 5 },
    { id: 'C', duration: 2 },
    { id: 'D', duration: 4 },
    { id: 'E', duration: 3 },
  ];
  const deps: [string, string][] = [
    ['A', 'C'],
    ['B', 'D'],
    ['C', 'E'],
    ['D', 'E'],
  ];

  it('computes project duration and critical path', () => {
    const result = calculateCriticalPath(nodes, deps);
    expect(result.projectDuration).toBe(12);
    expect(result.criticalPath).toEqual(['B', 'D', 'E']);
  });

  it('computes slack for non-critical nodes', () => {
    const result = calculateCriticalPath(nodes, deps);
    expect(result.timings.get('A')).toEqual({ es: 0, ef: 3, ls: 4, lf: 7, slack: 4 });
    expect(result.timings.get('C')?.slack).toBe(4);
  });

  it('handles independent nodes and empty input', () => {
    expect(calculateCriticalPath([], []).projectDuration).toBe(0);
    const result = calculateCriticalPath(
      [
        { id: 1, duration: 2 },
        { id: 2, duration: 5 },
      ],
      [],
    );
    expect(result.criticalPath).toEqual([2]);
    expect(result.timings.get(1)?.slack).toBe(3);
  });

  it('throws on cycles and unknown nodes', () => {
    const two = [
      { id: 'A', duration: 1 },
      { id: 'B', duration: 1 },
    ];
    expect(() =>
      calculateCriticalPath(two, [
        ['A', 'B'],
        ['B', 'A'],
      ]),
    ).toThrow(DependencyCycleError);
    expect(() => calculateCriticalPath(two, [['A', 'Z']])).toThrow(RangeError);
  });
});
