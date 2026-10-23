import type { ScheduleEdge, ScheduleTask } from '../application/schedule';

/**
 * §Productivity — manual dates vs. dependencies.
 *
 * A dependency says "the predecessor finishes before the successor starts", but nothing stops a
 * user from typing a successor start date *before* its predecessor's finish date. The schedule
 * only fills empty dates, so the contradiction would stay invisible until someone traced the
 * Gantt by hand. This pure pass reports the conflict so the write can answer with a warning
 * instead of rejecting the edit: the user may be mid-planning, and the warning is advisory.
 */

export interface TaskDateConflict {
  code: 'DEPENDENCY_DATE_CONFLICT';
  /** `predecessor`: an upstream task finishes after this task starts (start date too early).
   *  `successor`: a downstream task starts before this task finishes (due date too late). */
  direction: 'predecessor' | 'successor';
  relatedTaskId: number;
  relatedTaskTitle: string;
  /** Whole days between the two manual dates; always ≥ 1. */
  conflictDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const time = (value: string | null): number | null => (value === null ? null : new Date(value).getTime());

function reachable(
  adjacency: Map<number, number[]>,
  startId: number,
  byId: Map<number, ScheduleTask>,
): ScheduleTask[] {
  const seen = new Set<number>([startId]);
  const queue = [...(adjacency.get(startId) ?? [])];
  const found: ScheduleTask[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const task = byId.get(id);
    if (!task) continue;
    found.push(task);
    queue.push(...(adjacency.get(id) ?? []));
  }
  return found;
}

/**
 * Conflicts for one task after a manual date edit.
 *
 * Transitive on purpose: A → B → C with `A.dueDate` later than `C.startDate` is exactly as
 * impossible as a direct clash, even when B carries no dates of its own. Finished tasks are
 * ignored on both sides — their dates are history, not constraints.
 */
export function findDependencyDateConflicts(input: {
  taskId: number;
  tasks: ScheduleTask[];
  deps: ScheduleEdge[];
  /** Maximum warnings returned; the most severe (largest gap) come first. */
  limit?: number;
}): TaskDateConflict[] {
  const limit = input.limit ?? 3;
  const byId = new Map(input.tasks.map((task) => [task.id, task]));
  const task = byId.get(input.taskId);
  if (!task || task.status === 'DONE') return [];

  const successors = new Map<number, number[]>();
  const predecessors = new Map<number, number[]>();
  for (const { predecessorId, successorId } of input.deps) {
    const predecessor = byId.get(predecessorId);
    const successor = byId.get(successorId);
    if (!predecessor || !successor) continue;
    if (predecessor.status === 'DONE' || successor.status === 'DONE') continue;
    successors.set(predecessorId, [...(successors.get(predecessorId) ?? []), successorId]);
    predecessors.set(successorId, [...(predecessors.get(successorId) ?? []), predecessorId]);
  }

  const start = time(task.startDate);
  const due = time(task.dueDate);
  const conflicts: TaskDateConflict[] = [];

  if (start !== null) {
    for (const ancestor of reachable(predecessors, task.id, byId)) {
      const ancestorDue = time(ancestor.dueDate);
      if (ancestorDue === null || ancestorDue <= start) continue;
      conflicts.push({
        code: 'DEPENDENCY_DATE_CONFLICT',
        direction: 'predecessor',
        relatedTaskId: ancestor.id,
        relatedTaskTitle: ancestor.title,
        conflictDays: Math.max(1, Math.ceil((ancestorDue - start) / DAY_MS)),
      });
    }
  }

  if (due !== null) {
    for (const descendant of reachable(successors, task.id, byId)) {
      const descendantStart = time(descendant.startDate);
      if (descendantStart === null || descendantStart >= due) continue;
      conflicts.push({
        code: 'DEPENDENCY_DATE_CONFLICT',
        direction: 'successor',
        relatedTaskId: descendant.id,
        relatedTaskTitle: descendant.title,
        conflictDays: Math.max(1, Math.ceil((due - descendantStart) / DAY_MS)),
      });
    }
  }

  return conflicts.sort((a, b) => b.conflictDays - a.conflictDays).slice(0, limit);
}
