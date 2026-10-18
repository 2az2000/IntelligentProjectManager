/**
 * §Imp #4 Workload heatmap — pure week-window math, no DB and no clock.
 *
 * A task has no trustworthy per-day schedule, so a member's load for a week is the
 * `estimateHours` of their open tasks *spread evenly* across the weeks the task spans:
 * the remaining window is `[max(start, now), max(dueDate, now)]` — an open task whose due
 * date already passed keeps pressing the **current** week, which is the "this deadline is
 * already burning" signal the heatmap exists for. Tasks without dates count against the
 * current week only.
 *
 * Weeks are 7-day windows starting **Saturday** — Iran's first working day, in line with
 * the WORKING_WEEKEND default (Thu/Fri off).
 */

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Local midnight of the Saturday on or immediately before `date`. */
export function weekStart(of: Date): Date {
  const start = new Date(of);
  start.setHours(0, 0, 0, 0);
  // getDay(): Sun=0 … Sat=6 — shift back to the Saturday that opens this week.
  return new Date(start.getTime() - (((start.getDay() + 1) % 7) * 24 * 60 * 60 * 1000));
}

export interface WeekWindow {
  start: Date;
  /** Exclusive end. */
  end: Date;
}

/** `count` consecutive 7-day windows, week 0 opening on the Saturday at/before `now`. */
export function buildWeeks(now: Date, count: number): WeekWindow[] {
  const first = weekStart(now);
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(first.getTime() + i * WEEK_MS),
    end: new Date(first.getTime() + (i + 1) * WEEK_MS),
  }));
}

/**
 * Shares of `estimateHours` for each week, spread proportionally to the overlap of the
 * task's window with that week (window ⇒ [max(from, now), max(to, now)]; equal split for a
 * zero-length window — an unpointed (already due) task sits entirely in its own week).
 */
export function spreadAcrossWeeks(
  from: Date,
  to: Date,
  estimateHours: number,
  weeks: WeekWindow[],
  now: Date,
): number[] {
  const clamp = (d: Date) => Math.max(d.getTime(), now.getTime());
  const wStart = clamp(from);
  const wEnd = Math.max(clamp(to), wStart);
  const length = wEnd - wStart;

  return weeks.map(({ start, end }) => {
    const overlapStart = Math.max(wStart, start.getTime());
    const overlapEnd = Math.min(wEnd, end.getTime());
    const overlap = overlapEnd - overlapStart;
    if (length <= 0) {
      // Zero-length window: everything lands in the week containing wStart.
      return wStart >= start.getTime() && wStart < end.getTime() ? estimateHours : 0;
    }
    if (overlap <= 0) return 0;
    return (estimateHours * overlap) / length;
  });
}

export interface WorkloadTask {
  id: number;
  title: string;
  projectId: number;
  projectName: string;
  assigneeId: number | null;
  collaboratorIds: number[];
  startDate: Date | null;
  dueDate: Date | null;
  estimateHours: number | null;
  createdAt: Date;
}

export interface MemberRef {
  id: number;
}

export interface CellTasks {
  id: number;
  title: string;
  projectId: number;
  projectName: string;
  estimateHours: number | null;
  dueDate: Date | null;
}

export interface MemberWorkload {
  /** Summed spread (hours) per week, index-aligned with the requested weeks. */
  hours: number[];
  /** The tasks contributing to each week (index-aligned), ordered heaviest first. */
  tasks: CellTasks[][];
}

/**
 * Aggregates open tasks into a per-member × per-week hours matrix. A co-assigned task
 * counts **fully for every assignee** — mirrors `teamForUser`, where shared work must
 * show up on everyone attached to it, not get divided away by the number of owners.
 */
export function aggregateWorkload(
  tasks: WorkloadTask[],
  members: MemberRef[],
  weeks: WeekWindow[],
  now: Date,
): Map<number, MemberWorkload> {
  const result = new Map<number, MemberWorkload>();
  for (const m of members) {
    result.set(m.id, { hours: weeks.map(() => 0), tasks: weeks.map(() => []) });
  }

  for (const task of tasks) {
    if (task.estimateHours == null) continue; // nothing to spread over time
    const shares = spreadAcrossWeeks(
      task.startDate ?? task.createdAt,
      task.dueDate ?? task.startDate ?? task.createdAt,
      task.estimateHours,
      weeks,
      now,
    );
    shares.forEach((hours, weekIndex) => {
      if (hours <= 0) return;
      const entry: CellTasks = {
        id: task.id,
        title: task.title,
        projectId: task.projectId,
        projectName: task.projectName,
        estimateHours: hours,
        dueDate: task.dueDate,
      };
      const contributors = task.assigneeId == null ? task.collaboratorIds : [task.assigneeId, ...task.collaboratorIds];
      // A malformed row (lead also listed as collaborator) must not double-book the hours.
      for (const userId of new Set(contributors)) {
        const member = userId == null ? undefined : result.get(userId);
        if (!member) continue;
        member.hours[weekIndex] = (member.hours[weekIndex] ?? 0) + hours;
        member.tasks[weekIndex]?.push(entry);
      }
    });
  }

  for (const member of result.values()) {
    for (const list of member.tasks) list.sort((a, b) => (b.estimateHours ?? 0) - (a.estimateHours ?? 0));
  }
  return result;
}
