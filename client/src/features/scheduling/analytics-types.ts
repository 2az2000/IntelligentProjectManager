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
