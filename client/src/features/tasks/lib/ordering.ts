import type { Task, TaskStatus } from '../types';

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
  status: TaskStatus;
  beforeId?: number;
  afterId?: number;
  position: number;
}

type Card = Pick<Task, 'id' | 'status' | 'position'>;

/**
 * Where a dragged card lands. `overTaskId` is the card it was dropped on (undefined when dropped
 * on the empty part of a column ⇒ end of that column). Same-column moves follow arrayMove
 * semantics: dropping on a card further down places the dragged card after it.
 * Returns null when nothing changes.
 */
export function planDrop(
  tasks: Card[],
  activeId: number,
  targetStatus: TaskStatus,
  overTaskId?: number,
): DropPlan | null {
  const active = tasks.find((t) => t.id === activeId);
  if (!active || overTaskId === activeId) return null;

  const column = tasks.filter((t) => t.status === targetStatus).sort(byPosition);
  const rest = column.filter((t) => t.id !== activeId);

  let index = rest.length;
  const overIndex = overTaskId === undefined ? -1 : rest.findIndex((t) => t.id === overTaskId);
  if (overIndex >= 0) {
    const movingDown =
      active.status === targetStatus &&
      column.findIndex((t) => t.id === activeId) < column.findIndex((t) => t.id === overTaskId);
    index = movingDown ? overIndex + 1 : overIndex;
  }

  const result = [...rest.slice(0, index), active, ...rest.slice(index)];
  if (active.status === targetStatus && result.every((t, i) => t.id === column[i]?.id)) return null;

  const before = rest[index - 1];
  const after = rest[index];
  return {
    status: targetStatus,
    beforeId: before?.id,
    afterId: after?.id,
    position: positionBetween(before?.position, after?.position),
  };
}
