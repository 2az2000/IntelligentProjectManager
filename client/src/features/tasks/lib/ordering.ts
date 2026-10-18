import type { Task } from '../types';

/** Mirrors server/src/modules/tasks/domain/position.ts for optimistic updates. */
const STEP = 1024;

export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return STEP;
  if (before === undefined) return after! - STEP;
  if (after === undefined) return before + STEP;
  return before + (after - before) / 2;
}

export const byPosition = (a: Pick<Task, 'position' | 'id'>, b: Pick<Task, 'position' | 'id'>) =>
  a.position - b.position || a.id - b.id;

export interface DropPlan {
  /** Target workflow column (`ProjectStatus.key`). */
  statusKey: string;
  beforeId?: number;
  afterId?: number;
  position: number;
}

type Card = Pick<Task, 'id' | 'statusKey' | 'position'>;

/**
 * Where a dragged card lands when the user drops it at an explicit slot: `index` counts the cards
 * of the target column *without* the dragged one (0 = first, `length` = append at the end). This
 * is the plan the board's live preview renders, so dropping reproduces exactly what was seen.
 * Returns null when the card would keep its neighbours in its current column.
 */
export function planDropAtIndex(
  tasks: Card[],
  activeId: number,
  targetStatusKey: string,
  index: number,
): DropPlan | null {
  const active = tasks.find((t) => t.id === activeId);
  if (!active) return null;

  const column = tasks.filter((t) => t.statusKey === targetStatusKey).sort(byPosition);
  const rest = column.filter((t) => t.id !== activeId);
  const at = Math.min(Math.max(index, 0), rest.length);

  const before = rest[at - 1];
  const after = rest[at];

  if (active.statusKey === targetStatusKey) {
    const from = column.findIndex((t) => t.id === activeId);
    const keepsNeighbours =
      column[from - 1]?.id === before?.id && column[from + 1]?.id === after?.id;
    if (keepsNeighbours) return null;
  }

  return {
    statusKey: targetStatusKey,
    beforeId: before?.id,
    afterId: after?.id,
    position: positionBetween(before?.position, after?.position),
  };
}

/**
 * Where a dragged card lands when it is dropped *on another card*. Same-column moves follow
 * arrayMove semantics: dropping on a card further down places the dragged card after it.
 * Returns null when nothing changes.
 */
export function planDrop(
  tasks: Card[],
  activeId: number,
  targetStatusKey: string,
  overTaskId?: number,
): DropPlan | null {
  const active = tasks.find((t) => t.id === activeId);
  if (!active || overTaskId === activeId) return null;

  const column = tasks.filter((t) => t.statusKey === targetStatusKey).sort(byPosition);
  const rest = column.filter((t) => t.id !== activeId);
  const overIndex = overTaskId === undefined ? -1 : rest.findIndex((t) => t.id === overTaskId);

  // No card under the drop ⇒ the column surface itself, i.e. append at the end.
  if (overIndex < 0) return planDropAtIndex(tasks, activeId, targetStatusKey, rest.length);

  const movingDown =
    active.statusKey === targetStatusKey &&
    column.findIndex((t) => t.id === activeId) < column.findIndex((t) => t.id === overTaskId);

  return planDropAtIndex(tasks, activeId, targetStatusKey, movingDown ? overIndex + 1 : overIndex);
}
