import { describe, expect, it } from 'vitest';
import { MIN_POSITION_GAP, POSITION_STEP, evenPositions, positionBetween } from './position';

describe('positionBetween', () => {
  it('handles empty columns and edges', () => {
    expect(positionBetween()).toBe(POSITION_STEP);
    expect(positionBetween(2048)).toBe(2048 + POSITION_STEP);
    expect(positionBetween(undefined, 1024)).toBe(0);
  });

  it('returns the midpoint between neighbours', () => {
    expect(positionBetween(1024, 2048)).toBe(1536);
  });

  it('asks for a rebalance when the gap is exhausted or order is invalid', () => {
    expect(positionBetween(1, 1 + MIN_POSITION_GAP)).toBeNull();
    expect(positionBetween(5, 5)).toBeNull();
    expect(positionBetween(6, 5)).toBeNull();
  });

  it('survives many insertions at the same spot before needing a rebalance', () => {
    let before = 1024;
    const after = 2048;
    let inserts = 0;
    for (;;) {
      const next = positionBetween(before, after);
      if (next === null) break;
      expect(next).toBeGreaterThan(before);
      expect(next).toBeLessThan(after);
      before = next;
      inserts++;
    }
    expect(inserts).toBeGreaterThan(25);
  });
});

describe('evenPositions', () => {
  it('spaces items by STEP', () => {
    expect(evenPositions(3)).toEqual([1024, 2048, 3072]);
  });
});
