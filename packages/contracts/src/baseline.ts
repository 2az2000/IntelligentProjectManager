import type { UserSummary } from './task';
import type { ZodInstance } from './task';

/**
 * A baseline is a snapshot of the CPM plan: each task's position on the working-hour axis.
 *
 * Working hours (not calendar dates) are the snapshot's unit on purpose — the schedule is
 * computed, not stored, so "the plan slipped by 16 working hours" is exact and repeatable.
 */
export const MAX_BASELINE_NAME = 80;
/** Old snapshots are cheap, but a runaway list is not a feature. */
export const MAX_BASELINES_PER_PROJECT = 20;

/** How a task differs from the moment the baseline was taken. */
export const BASELINE_TASK_ACTIONS = ['added', 'removed', 'moved', 'onTrack'] as const;
export type BaselineTaskAction = (typeof BASELINE_TASK_ACTIONS)[number];

export interface BaselineSummary {
  id: number;
  projectId: number;
  name: string;
  createdAt: string;
  createdBy: UserSummary;
  /** Top-level tasks captured in the snapshot. */
  taskCount: number;
  /** Longest chained effort when the baseline was taken, in working hours. */
  projectDurationHours: number;
}

export interface BaselineTaskChange {
  taskId: number;
  /** The baseline keeps the title, so a since-deleted task is still readable. */
  title: string;
  action: BaselineTaskAction;
  baselineStartHours: number | null;
  baselineFinishHours: number | null;
  currentStartHours: number | null;
  currentFinishHours: number | null;
  /** current − baseline in working hours; positive means the task now starts later. */
  driftHours: number | null;
}

export interface BaselineVariance {
  baseline: BaselineSummary;
  currentDurationHours: number;
  /** current − baseline, in working hours (can be negative when the plan got shorter). */
  durationDriftHours: number;
  counts: Record<BaselineTaskAction, number>;
  /** Sum of the positive slips only — the honest "how much did we lose" number. */
  totalDriftHours: number;
  tasks: BaselineTaskChange[];
}

/** `POST /projects/:projectId/baselines`; the server names it when omitted. */
export const createBaselinePayloadSchema = (z: ZodInstance) =>
  z
    .object({
      name: z.string().trim().min(1).max(MAX_BASELINE_NAME).optional(),
    })
    .strict();
export type CreateBaselinePayload = {
  name?: string;
};
