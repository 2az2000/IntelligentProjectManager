/** Mirrors SchedulingDto / DependencyDto in docs/02-API-CONTRACT.md */
export const DEPENDENCY_TYPES = ['FINISH_TO_START'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export type SchedulableStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

export interface ScheduledTask {
  id: number;
  title: string;
  status: SchedulableStatus;
  /** Effort estimate in working hours; null = not estimated yet. */
  estimateHours: number | null;
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
  scheduledStart: string | null;
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

export interface DependencyView {
  predecessorId: number;
  successorId: number;
  type: DependencyType;
}
