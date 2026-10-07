/**
 * §3 automatic risk score (0–100) per top-level task — the manager should not have
 * to hunt for what is burning; the list sorts itself. Deterministic, tunable
 * weights; computed from the schedule + live task rows on every request.
 */

export interface RiskTask {
  id: number;
  status: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: Date | null;
  estimateHours: number | null;
  /** Working hours of total float from the CPM pass (null = unestimated). */
  slack: number | null;
  /** True when the task sits on the critical chain. */
  isCritical: boolean;
  /** Days since the last activity on the task (stale work hides trouble). */
  daysSinceUpdate: number | null;
  /** Open estimate hours assigned to this task's assignee across the project. */
  assigneeOpenHours: number | null;
  /** The assignee's weekly capacity (null = unknown, no penalty). */
  assigneeCapacityHours: number | null;
}

export interface RiskWeights {
  overdue: number;
  dueSoon: number;
  noDueDate: number;
  unestimated: number;
  critical: number;
  /** Per-24h of missing slack, up to the cap. */
  slackPressure: number;
  slackPressureCap: number;
  staleDaysPer7: number;
  staleCap: number;
  overAllocation: number;
  priorityBoost: number;
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = {
  overdue: 45,
  dueSoon: 20,
  noDueDate: 8,
  unestimated: 10,
  critical: 18,
  slackPressure: 6,
  slackPressureCap: 18,
  staleDaysPer7: 4,
  staleCap: 12,
  overAllocation: 15,
  priorityBoost: { LOW: 0, MEDIUM: 0, HIGH: 5, URGENT: 12 } as unknown as number,
} as RiskWeights;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Score in [0, 100]: the weighted sum of risk signals, clamped. Higher = burning.
 * Done tasks always score 0. `now` is injected for testability.
 */
export function computeRiskScore(task: RiskTask, now: Date, weights: RiskWeights = DEFAULT_RISK_WEIGHTS): number {
  if (task.status === 'DONE') return 0;
  let score = 0;

  const priorityBoost = (weights.priorityBoost as unknown as Record<string, number>)[task.priority] ?? 0;
  score += priorityBoost;

  if (task.dueDate) {
    const due = new Date(task.dueDate).getTime();
    if (due < now.getTime()) score += weights.overdue;
    else if (due - now.getTime() < 3 * DAY_MS) score += weights.dueSoon;
  } else {
    score += weights.noDueDate;
  }

  if (task.estimateHours === null || task.estimateHours <= 0) score += weights.unestimated;

  if (task.isCritical) score += weights.critical;
  else if (task.slack !== null) {
    const missingSlack = Math.max(0, -task.slack);
    score += Math.min(weights.slackPressureCap, (missingSlack / 24) * weights.slackPressure);
  }

  if (task.daysSinceUpdate !== null) {
    score += Math.min(weights.staleCap, (task.daysSinceUpdate / 7) * weights.staleDaysPer7);
  }

  if (
    task.assigneeOpenHours !== null &&
    task.assigneeCapacityHours !== null &&
    task.assigneeCapacityHours > 0 &&
    task.assigneeOpenHours > task.assigneeCapacityHours
  ) {
    score += weights.overAllocation;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export interface RiskView {
  taskId: number;
  score: number;
  /** Machine-readable signals that fired — the UI can explain every point. */
  reasons: string[];
}

/** Scores a whole set of tasks; returns them sorted by score desc, then id. */
export function computeRiskScores(
  tasks: RiskTask[],
  now: Date,
  weights: RiskWeights = DEFAULT_RISK_WEIGHTS,
): RiskView[] {
  const views: RiskView[] = [];
  for (const task of tasks) {
    const score = computeRiskScore(task, now, weights);
    const reasons: string[] = [];
    if (task.status !== 'DONE') {
      if (task.dueDate && new Date(task.dueDate).getTime() < now.getTime()) reasons.push('overdue');
      else if (task.dueDate && new Date(task.dueDate).getTime() - now.getTime() < 3 * DAY_MS)
        reasons.push('due-soon');
      if (!task.dueDate) reasons.push('no-due-date');
      if (task.estimateHours === null || task.estimateHours <= 0) reasons.push('unestimated');
      if (task.isCritical) reasons.push('critical');
      if (task.slack !== null && task.slack < 0) reasons.push('slack-pressured');
      if (task.daysSinceUpdate !== null && task.daysSinceUpdate >= 7) reasons.push('stale');
      if (
        task.assigneeOpenHours !== null &&
        task.assigneeCapacityHours !== null &&
        task.assigneeOpenHours > task.assigneeCapacityHours
      )
        reasons.push('assignee-overloaded');
    }
    views.push({ taskId: task.id, score, reasons });
  }
  return views.sort((a, b) => b.score - a.score || a.taskId - b.taskId);
}
