/**
 * Fractional indexing for ordering cards inside a Kanban column.
 *
 * Every task has a float `position`; moving a card only rewrites that one row with a value
 * between its new neighbours. When the gap between neighbours becomes too small for doubles,
 * the column is rebalanced (renumbered with an even STEP) — rare, O(n) for that column only.
 */
export const POSITION_STEP = 1024;
export const MIN_POSITION_GAP = 1e-6;

/**
 * A position strictly between `before` (the card above) and `after` (the card below).
 * `undefined` means "no neighbour on that side". Returns null when a rebalance is required.
 */
export function positionBetween(before?: number, after?: number): number | null {
  if (before === undefined && after === undefined) return POSITION_STEP;
  if (before === undefined) return after! - POSITION_STEP;
  if (after === undefined) return before + POSITION_STEP;
  if (after <= before) return null;
  if (after - before < MIN_POSITION_GAP * 2) return null;
  return before + (after - before) / 2;
}

/** Evenly spaced positions for `count` items: STEP, 2·STEP, ... */
export function evenPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}
