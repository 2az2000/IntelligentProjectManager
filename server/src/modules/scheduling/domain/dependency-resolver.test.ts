import { describe, expect, it } from 'vitest';
import { Graph } from './graph';
import { hasCycle, topologicalSort, wouldCreateCycle } from './dependency-resolver';

function sample(): Graph<number> {
  const g = new Graph<number>();
  g.addEdge(1, 2);
  g.addEdge(2, 3);
  g.addEdge(1, 3);
  return g;
}

describe('dependency resolver', () => {
  it('returns a topological order', () => {
    const order = topologicalSort(sample());
    expect(order.indexOf(1)).toBeLessThan(order.indexOf(2));
    expect(order.indexOf(2)).toBeLessThan(order.indexOf(3));
  });

  it('detects cycles', () => {
    const g = sample();
    expect(hasCycle(g)).toBe(false);
    g.addEdge(3, 1);
    expect(hasCycle(g)).toBe(true);
  });

  it('predicts whether a new edge would create a cycle', () => {
    const g = sample();
    expect(wouldCreateCycle(g, 3, 1)).toBe(true);
    expect(wouldCreateCycle(g, 2, 2)).toBe(true);
    expect(wouldCreateCycle(g, 1, 4)).toBe(false);
  });
});
