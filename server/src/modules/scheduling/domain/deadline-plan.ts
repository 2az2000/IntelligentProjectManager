import { buildSchedule, type ScheduleEdge, type ScheduleTask } from '../application/schedule';
import { HolidayCalendar, addWorkingHoursWithHolidays } from './holidays';

/**
 * §3 deadline planner — the inverse of CPM.
 *
 * CPM answers "when will we finish?"; a manager usually asks the opposite: "the client needs it
 * on the 25th — when must each task start, and what has to start today?".
 *
 * The math is intentionally simple and explainable: the deterministic schedule gives every task an
 * earliest start; the Monte Carlo P50/P85/P95 duration of the whole project gives a required
 * effort; the gap between the deadline and that effort is one buffer that shifts **every** task
 * equally. Shifting all nodes by the same amount preserves finish-to-start edges, so the plan is a
 * valid backward pass without a second graph algorithm. A negative buffer means the deadline is
 * unattainable at the requested confidence — reported as `feasible: false`, not hidden.
 */

export type PlanConfidence = 50 | 85 | 95;

export interface DeadlinePlanTask {
  taskId: number;
  title: string;
  status: string;
  estimateHours: number | null;
  /** Latest start/finish at the requested confidence, in calendar time from the anchor. */
  latestStart: string | null;
  latestFinish: string | null;
  /** Buffer share left after this task (working hours; negative = already late). */
  slackHours: number | null;
  isCritical: boolean;
  /** True when the latest start is now or in the past — the task must start immediately. */
  mustStartNow: boolean;
}

export interface DeadlinePlan {
  deadline: string;
  anchor: string;
  confidence: PlanConfidence;
  feasible: boolean;
  /** Hours the user has between the anchor and the deadline (working hours). */
  availableHours: number;
  /** Effort the project needs at the chosen confidence (Monte Carlo percentile). */
  requiredHours: number;
  /** Deterministic CPM duration, for comparison in the UI. */
  projectDurationHours: number;
  bufferHours: number;
  bufferWorkingDays: number;
  tasks: DeadlinePlanTask[];
  /** Ids of tasks whose latest start has passed. */
  mustStartNow: number[];
  unestimatedTaskIds: number[];
}

const HOUR = 60 * 60 * 1000;

const isWorking = (date: Date, weekend: Set<number>, holidays: HolidayCalendar) =>
  !weekend.has(date.getDay()) && !holidays.isHoliday(date);

/**
 * Whole working hours between two instants, honouring weekends and holidays.
 * Hour-by-hour on purpose: a year is < 9000 steps and the rounding cannot disagree with
 * `addWorkingHoursWithHolidays` (which also counts hour slots).
 */
export function workingHoursBetween(
  from: Date,
  to: Date,
  weekend: Set<number>,
  holidays: HolidayCalendar,
): number {
  if (to.getTime() <= from.getTime()) return 0;
  let cursor = new Date(from.getTime());
  let hours = 0;
  while (cursor.getTime() < to.getTime()) {
    if (isWorking(cursor, weekend, holidays)) hours += 1;
    cursor = new Date(cursor.getTime() + HOUR);
  }
  return hours;
}

/** Whole working days (for the human-readable buffer line). */
export function workingDays(hours: number): number {
  return Math.round((hours / 8) * 10) / 10;
}

export function buildDeadlinePlan(input: {
  tasks: ScheduleTask[];
  deps: ScheduleEdge[];
  anchor: Date;
  deadline: Date;
  /** Project effort at the requested confidence, in working hours (Monte Carlo percentile). */
  requiredHours: number;
  confidence: PlanConfidence;
  weekend: Set<number>;
  holidays: HolidayCalendar;
}): DeadlinePlan {
  const schedule = buildSchedule(input.tasks, input.deps, input.weekend);
  const availableHours = workingHoursBetween(input.anchor, input.deadline, input.weekend, input.holidays);
  const buffer = availableHours - input.requiredHours;

  const tasks: DeadlinePlanTask[] = schedule.tasks
    .filter((t) => t.status !== 'DONE' && t.earliestStart !== null)
    .map((t) => {
      const estimate = t.estimateHours ?? 0;
      const latestStartHours = t.earliestStart! + buffer;
      // A task's latest start may already be behind us; the date is still shown (clamped to the
      // anchor would hide how late it is), so the UI can say "started 3 days ago".
      const latestStart = addWorkingHoursWithHolidays(input.anchor, latestStartHours, input.weekend, input.holidays);
      const latestFinish = addWorkingHoursWithHolidays(
        input.anchor,
        latestStartHours + estimate,
        input.weekend,
        input.holidays,
      );
      return {
        taskId: t.id,
        title: t.title,
        status: t.status,
        estimateHours: t.estimateHours,
        latestStart: latestStart.toISOString(),
        latestFinish: latestFinish.toISOString(),
        slackHours: latestStartHours,
        isCritical: t.isCritical,
        mustStartNow: latestStartHours <= 0,
      };
    })
    .sort((a, b) => (a.slackHours ?? 0) - (b.slackHours ?? 0));

  return {
    deadline: input.deadline.toISOString(),
    anchor: input.anchor.toISOString(),
    confidence: input.confidence,
    feasible: buffer >= 0,
    availableHours,
    requiredHours: input.requiredHours,
    projectDurationHours: schedule.projectDurationHours,
    bufferHours: buffer,
    bufferWorkingDays: workingDays(buffer),
    tasks,
    mustStartNow: tasks.filter((t) => t.mustStartNow).map((t) => t.taskId),
    unestimatedTaskIds: schedule.unestimatedTaskIds,
  };
}
