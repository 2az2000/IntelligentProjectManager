import type { ScheduledTask } from '../types';

/** One horizontal row of the Gantt: bar geometry as percentages of the time scale. */
export interface TimelineRow {
  task: ScheduledTask;
  /** Row order in the chart (also used as the SVG y coordinate). */
  index: number;
  hasBar: boolean;
  leftPct: number;
  widthPct: number;
  /** Hatched slack segment right after the bar (0 when there is no slack). */
  slackPct: number;
}

export interface TimelineLayout {
  rows: TimelineRow[];
  /** Time scale in hours (>= 1 so percentages are always finite). */
  totalHours: number;
}

const MIN_BAR_PCT = 1.5;

/** Rows are ordered along the timeline: estimated work first (by start), then unestimated. */
export function buildTimelineLayout(tasks: ScheduledTask[]): TimelineLayout {
  const estimated = tasks
    .filter((t) => t.earliestStart !== null)
    .sort((a, b) => a.earliestStart! - b.earliestStart! || a.id - b.id);
  const unestimated = tasks
    .filter((t) => t.earliestStart === null)
    .sort((a, b) => a.id - b.id);

  const totalHours = Math.max(
    1,
    ...tasks.map((t) => Math.max(t.earliestFinish ?? 0, (t.earliestStart ?? 0) + (t.estimateHours ?? 0))),
  );

  const rows = [...estimated, ...unestimated].map((task, index) => {
    const hasBar = task.estimateHours !== null;
    const leftPct = ((task.earliestStart ?? 0) / totalHours) * 100;
    const rawWidth = ((task.estimateHours ?? 0) / totalHours) * 100;
    const widthPct = hasBar ? Math.max(rawWidth, MIN_BAR_PCT) : 0;
    const slackPct = hasBar && task.slack ? (task.slack / totalHours) * 100 : 0;
    return { task, index, hasBar, leftPct, widthPct, slackPct };
  });

  return { rows, totalHours };
}

export interface DependencyArrow {
  predecessorId: number;
  successorId: number;
  x1: number;
  x2: number;
  fromRow: number;
  toRow: number;
}

/**
 * Finish-to-start arrows in percentage coordinates. Arrows touching a task
 * without a bar (unestimated / zero-width) are skipped — there is no anchor.
 */
export function buildDependencyArrows(
  layout: TimelineLayout,
  deps: { predecessorId: number; successorId: number }[],
): DependencyArrow[] {
  const byId = new Map(layout.rows.map((row) => [row.task.id, row]));
  const arrows: DependencyArrow[] = [];
  for (const dep of deps) {
    const from = byId.get(dep.predecessorId);
    const to = byId.get(dep.successorId);
    if (!from?.hasBar || !to?.hasBar) continue;
    arrows.push({
      predecessorId: dep.predecessorId,
      successorId: dep.successorId,
      x1: from.leftPct + from.widthPct,
      x2: to.leftPct,
      fromRow: from.index,
      toRow: to.index,
    });
  }
  return arrows;
}

/** Project finish derived from the schedule: the latest scheduled task finish. */
export function predictedFinish(schedule: {
  tasks: ScheduledTask[];
  projectDurationHours: number;
}, anchor: Date): Date {
  const finishes = schedule.tasks
    .map((t) => t.scheduledFinish)
    .filter((v): v is string => v !== null)
    .map((v) => new Date(v).getTime());
  if (finishes.length > 0) return new Date(Math.max(...finishes));
  return new Date(anchor.getTime() + schedule.projectDurationHours * 60 * 60 * 1000);
}
