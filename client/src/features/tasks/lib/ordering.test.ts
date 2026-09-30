import { describe, expect, it } from 'vitest';
import { planDrop, positionBetween } from './ordering';

const cards = [
  { id: 1, status: 'TODO' as const, position: 1024 },
  { id: 2, status: 'TODO' as const, position: 2048 },
  { id: 3, status: 'TODO' as const, position: 3072 },
  { id: 4, status: 'DONE' as const, position: 1024 },
];

describe('positionBetween', () => {
  it('computes midpoints and edges', () => {
    expect(positionBetween()).toBe(1024);
    expect(positionBetween(1024, 2048)).toBe(1536);
    expect(positionBetween(undefined, 1024)).toBe(0);
    expect(positionBetween(3072)).toBe(4096);
  });
});

describe('planDrop', () => {
  it('moves a card down within a column (after the target)', () => {
    expect(planDrop(cards, 1, 'TODO', 2)).toEqual({ status: 'TODO', beforeId: 2, afterId: 3, position: 2560 });
  });

  it('moves a card up within a column (before the target)', () => {
    expect(planDrop(cards, 3, 'TODO', 1)).toEqual({ status: 'TODO', beforeId: undefined, afterId: 1, position: 0 });
  });

  it('moves a card into another column before the target card', () => {
    expect(planDrop(cards, 2, 'DONE', 4)).toMatchObject({ status: 'DONE', afterId: 4, beforeId: undefined });
  });

  it('appends when dropped on the column itself', () => {
    expect(planDrop(cards, 1, 'DONE')).toMatchObject({ beforeId: 4, afterId: undefined, position: 2048 });
  });

  it('returns null when nothing changes', () => {
    expect(planDrop(cards, 3, 'TODO')).toBeNull();
    expect(planDrop(cards, 2, 'TODO', 2)).toBeNull();
  });
});
