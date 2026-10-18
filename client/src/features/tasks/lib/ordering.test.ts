import { describe, expect, it } from 'vitest';
import { planDrop, planDropAtIndex, positionBetween } from './ordering';

const cards = [
  { id: 1, statusKey: 'TODO', position: 1024 },
  { id: 2, statusKey: 'TODO', position: 2048 },
  { id: 3, statusKey: 'TODO', position: 3072 },
  { id: 4, statusKey: 'DONE', position: 1024 },
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
    expect(planDrop(cards, 1, 'TODO', 2)).toEqual({ statusKey: 'TODO', beforeId: 2, afterId: 3, position: 2560 });
  });

  it('moves a card up within a column (before the target)', () => {
    expect(planDrop(cards, 3, 'TODO', 1)).toEqual({ statusKey: 'TODO', beforeId: undefined, afterId: 1, position: 0 });
  });

  it('moves a card into another column before the target card', () => {
    expect(planDrop(cards, 2, 'DONE', 4)).toMatchObject({ statusKey: 'DONE', afterId: 4, beforeId: undefined });
  });

  it('appends when dropped on the column itself', () => {
    expect(planDrop(cards, 1, 'DONE')).toMatchObject({ beforeId: 4, afterId: undefined, position: 2048 });
  });

  it('returns null when nothing changes', () => {
    expect(planDrop(cards, 3, 'TODO')).toBeNull();
    expect(planDrop(cards, 2, 'TODO', 2)).toBeNull();
  });
});

describe('planDropAtIndex', () => {
  it('places the card at the index the preview showed', () => {
    expect(planDropAtIndex(cards, 3, 'TODO', 1)).toEqual({
      statusKey: 'TODO',
      beforeId: 1,
      afterId: 2,
      position: 1536,
    });
  });

  it('appends when the index is past the last card', () => {
    expect(planDropAtIndex(cards, 1, 'TODO', 2)).toMatchObject({
      beforeId: 3,
      afterId: undefined,
      position: 4096,
    });
  });

  it('keeps the index inside the column bounds', () => {
    expect(planDropAtIndex(cards, 1, 'DONE', 99)).toMatchObject({ statusKey: 'DONE', afterId: undefined });
    expect(planDropAtIndex(cards, 2, 'DONE', -5)).toMatchObject({ statusKey: 'DONE', beforeId: undefined, afterId: 4 });
  });

  it('returns null when the card keeps its neighbours in its own column', () => {
    // Index 0 among the cards that stay put is exactly where card 1 already is.
    expect(planDropAtIndex(cards, 1, 'TODO', 0)).toBeNull();
    expect(planDropAtIndex(cards, 2, 'TODO', 1)).toBeNull();
  });

  it('still moves within the same column when the neighbours change', () => {
    expect(planDropAtIndex(cards, 1, 'TODO', 2)).toMatchObject({ beforeId: 3, position: 4096 });
  });
});
