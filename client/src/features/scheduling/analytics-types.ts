/** Mirrors analytics DTOs in docs/02-API-CONTRACT.md (§3 forecasting & risk). */
export interface ForecastResult {
  runs: number;
  p50Hours: number;
  p85Hours: number;
  p95Hours: number;
  p50Date: string;
  p85Date: string;
  p95Date: string;
  /** Chance of finishing before the project's endDate; null without a deadline. */
  deadlineProbability: number | null;
  tasks: { taskId: number; criticality: number }[];
}

export interface RiskTask {
  taskId: number;
  score: number;
  reasons: string[];
  title: string;
  status: string;
}

export interface RiskResult {
  tasks: RiskTask[];
  generatedAt: string;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

export interface BurndownResult {
  from: string;
  to: string;
  total: number;
  points: BurndownPoint[];
}

/** §3 deadline planner — the inverse of CPM at a chosen Monte Carlo confidence. */
export type PlanConfidence = 50 | 85 | 95;

export interface DeadlinePlanTask {
  taskId: number;
  title: string;
  status: string;
  estimateHours: number | null;
  latestStart: string | null;
  latestFinish: string | null;
  slackHours: number | null;
  isCritical: boolean;
  mustStartNow: boolean;
}

export interface DeadlinePlan {
  deadline: string;
  anchor: string;
  confidence: PlanConfidence;
  feasible: boolean;
  availableHours: number;
  requiredHours: number;
  projectDurationHours: number;
  bufferHours: number;
  bufferWorkingDays: number;
  tasks: DeadlinePlanTask[];
  mustStartNow: number[];
  unestimatedTaskIds: number[];
}
