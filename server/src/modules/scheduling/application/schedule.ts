import { calculateCriticalPath } from '../domain/critical-path';
import { addWorkingHours } from '../domain/work-calendar';

/** One node of the project graph — a top-level task with its scheduling inputs. */
export interface ScheduleTask {
  id: number;
  title: string;
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
  /** Effort estimate in working hours; null = not estimated yet. */
  estimateHours: number | null;
  /** Manual start constraint (calendar anchor for the computed offsets). */
  startDate: string | null;
  dueDate: string | null;
}

/** Predecessor → successor edge (finish-to-start). */
export interface ScheduleEdge {
  predecessorId: number;
  successorId: number;
}

export interface ScheduledTask {
  id: number;
  title: string;
  status: ScheduleTask['status'];
  estimateHours: number | null;
  /** Manual inputs, echoed back (day precision). */
  startDate: string | null;
  dueDate: string | null;
  /** CPM timings in working hours; null when the task has no estimate. */
  earliestStart: number | null;
  earliestFinish: number | null;
  latestStart: number | null;
  latestFinish: number | null;
  /** Total float in working hours; 0 on the critical path. */
  slack: number | null;
  isCritical: boolean;
  /** startDate shifted by the computed earliest start (null without a manual startDate). */
  scheduledStart: string | null;
  /** scheduledStart + estimate hours; null without a manual startDate or estimate. */
  scheduledFinish: string | null;
}

export interface ScheduleResult {
  /** Longest chained effort of the project, in working hours. */
  projectDurationHours: number;
  /** Critical chain (slack = 0) in topological order. */
  criticalPath: number[];
  tasks: ScheduledTask[];
  /** Top-level tasks without an estimate — the UI should ask the user to estimate them. */
  unestimatedTaskIds: number[];
}

/**
 * Critical Path Method over the project's tasks and dependencies.
 * Finished tasks contribute zero effort; unestimated tasks pass through the
 * graph with zero duration so their timing still reflects their position.
 * `weekend` (JS getDay() values) converts hour offsets to calendar dates by
 * skipping non-working days — empty set means every calendar day counts.
 */
export function buildSchedule(
  tasks: ScheduleTask[],
  deps: ScheduleEdge[],
  weekend: Set<number> = new Set(),
): ScheduleResult {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  // Drop edges that reference tasks outside the set (e.g. deleted mid-read).
  const edges = deps.filter((d) => byId.has(d.predecessorId) && byId.has(d.successorId));

  const nodes = tasks.map((t) => ({
    id: t.id,
    duration: t.status === 'DONE' ? 0 : (t.estimateHours ?? 0),
  }));
  const { projectDuration, criticalPath, timings } = calculateCriticalPath(
    nodes,
    edges.map((e) => [e.predecessorId, e.successorId] as [number, number]),
  );
  const critical = new Set(
    criticalPath.filter((id) => {
      const t = byId.get(id);
      // Only estimated, unfinished work belongs to the critical chain.
      return t !== undefined && t.estimateHours !== null && t.status !== 'DONE';
    }),
  );

  const scheduled: ScheduledTask[] = tasks.map((t) => {
    const tm = timings.get(t.id)!;
    const hasEstimate = t.estimateHours !== null;
    const scheduledStart = t.startDate
      ? addWorkingHours(new Date(t.startDate), tm.es, weekend).toISOString()
      : null;
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      estimateHours: t.estimateHours,
      startDate: t.startDate,
      dueDate: t.dueDate,
      earliestStart: hasEstimate ? tm.es : null,
      earliestFinish: hasEstimate ? tm.ef : null,
      latestStart: hasEstimate ? tm.ls : null,
      latestFinish: hasEstimate ? tm.lf : null,
      slack: hasEstimate ? tm.slack : null,
      isCritical: hasEstimate && critical.has(t.id),
      scheduledStart,
      scheduledFinish:
        scheduledStart && t.estimateHours
          ? addWorkingHours(new Date(scheduledStart), t.estimateHours, weekend).toISOString()
          : null,
    };
  });

  return {
    projectDurationHours: projectDuration,
    criticalPath: [...critical],
    tasks: scheduled,
    unestimatedTaskIds: tasks
      .filter((t) => t.estimateHours === null && t.status !== 'DONE')
      .map((t) => t.id),
  };
}
