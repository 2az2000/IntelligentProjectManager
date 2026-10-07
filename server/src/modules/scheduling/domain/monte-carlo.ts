/**
 * §3 Monte Carlo forecasting — a CPM finish date is a single-point lie built from
 * optimistic human estimates. Running the existing CPM engine many times with
 * randomized (triangular) durations turns "March 3rd" into "P85 = March 10th, 85% sure".
 */

export interface McTask {
  id: number;
  /** Optimistic estimate = likely × 0.75 (optimistic human bias). */
  estimateHours: number | null;
  /** Finished tasks never vary — they contribute zero duration in every run. */
  status: string;
}

export interface McEdge {
  predecessorId: number;
  successorId: number;
}

export interface McConfig {
  /** Number of CPM runs (default 2000). */
  runs: number;
  /** Min/likely/max multipliers of the estimate for the triangular distribution. */
  optimisticFactor: number;
  pessimisticFactor: number;
  /** Working-hour fallback for unestimated tasks (median of the estimated ones). */
  unestimatedFallbackHours: number;
}

export const DEFAULT_MC_CONFIG: McConfig = {
  runs: 2000,
  optimisticFactor: 0.75,
  pessimisticFactor: 1.5,
  unestimatedFallbackHours: 8,
};

export interface McResult {
  runs: number;
  /** Finishing hours across all runs, sorted ascending. */
  samples: number[];
  /** Percentile hour offsets of the project finish (P50/P85/P95). */
  p50: number;
  p85: number;
  p95: number;
  /** Percentile share of runs in which each task sat on the critical chain. */
  criticality: Map<number, number>;
  /** Mean sampled duration of each task (for tooltips). */
  meanDuration: Map<number, number>;
}

/** Triangular inverse-CDF — deterministic shape, seeded per call by Math.random(). */
function triangular(min: number, likely: number, max: number, u: number): number {
  if (max <= min) return likely;
  return u < (likely - min) / (max - min)
    ? min + Math.sqrt(u * (likely - min) * (max - min))
    : max - Math.sqrt((1 - u) * (max - likely) * (max - min));
}

/** Working-hour offset of the finish line at percentile `p` (0..1) of the sorted samples. */
function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const index = Math.min(samples.length - 1, Math.ceil(p * samples.length) - 1);
  return samples[index]!;
}

/**
 * Runs the CPM engine `config.runs` times with triangular-sampled durations.
 * `runCpm` is injected so the Monte Carlo module stays decoupled from the
 * critical-path implementation (and easy to unit test with a fake).
 */
export function runMonteCarlo(
  tasks: McTask[],
  deps: McEdge[],
  runCpm: (
    nodes: { id: number; duration: number }[],
    edges: [number, number][],
  ) => { projectDuration: number; criticalPath: number[] },
  config: Partial<McConfig> = {},
): McResult {
  const cfg = { ...DEFAULT_MC_CONFIG, ...config };
  const estimated = tasks
    .map((t) => t.estimateHours)
    .filter((h): h is number => h !== null && h > 0)
    .sort((a, b) => a - b);
  const fallback = estimated.length > 0 ? estimated[Math.floor(estimated.length / 2)]! : 8;

  const samples: number[] = [];
  const criticalCounts = new Map<number, number>();
  const durationSums = new Map<number, number>();

  for (let run = 0; run < cfg.runs; run++) {
    const nodes = tasks.map((t) => {
      let duration: number;
      if (t.status === 'DONE') {
        duration = 0;
      } else if (t.estimateHours === null || t.estimateHours <= 0) {
        duration = fallback;
      } else {
        const min = t.estimateHours * cfg.optimisticFactor;
        const max = t.estimateHours * cfg.pessimisticFactor;
        duration = triangular(min, t.estimateHours, max, Math.random());
      }
      durationSums.set(t.id, (durationSums.get(t.id) ?? 0) + duration);
      return { id: t.id, duration };
    });

    const result = runCpm(
      nodes,
      deps.map((d) => [d.predecessorId, d.successorId] as [number, number]),
    );
    samples.push(result.projectDuration);
    for (const id of result.criticalPath) {
      criticalCounts.set(id, (criticalCounts.get(id) ?? 0) + 1);
    }
  }

  samples.sort((a, b) => a - b);
  return {
    runs: cfg.runs,
    samples,
    p50: percentile(samples, 0.5),
    p85: percentile(samples, 0.85),
    p95: percentile(samples, 0.95),
    criticality: new Map(
      [...criticalCounts.entries()].map(([id, count]) => [id, count / cfg.runs]),
    ),
    meanDuration: new Map(
      [...durationSums.entries()].map(([id, sum]) => [id, sum / cfg.runs]),
    ),
  };
}

/**
 * Probability of finishing the whole chain within `deadlineHours` of working time,
 * derived from the empirical samples (share of runs that finished in time).
 */
export function probabilityWithin(samples: number[], deadlineHours: number): number {
  if (samples.length === 0) return 0;
  const within = samples.filter((s) => s <= deadlineHours).length;
  return within / samples.length;
}
