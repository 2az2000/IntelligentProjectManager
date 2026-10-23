import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import type { PlanConfidence } from '../analytics-types';
import { analyticsApi } from '../api/analytics.api';

const validId = (id: number | null | undefined): id is number =>
  typeof id === 'number' && Number.isFinite(id) && id > 0;

/** §3 Monte Carlo percentiles + deadline probability. */
export function useForecast(projectId: number) {
  return useQuery({
    queryKey: qk.analytics.forecast(projectId),
    queryFn: () => analyticsApi.forecast(projectId),
    enabled: validId(projectId),
  });
}

/** §3 risk-sorted task list with explainable reasons. */
export function useRisks(projectId: number) {
  return useQuery({
    queryKey: qk.analytics.risks(projectId),
    queryFn: () => analyticsApi.risks(projectId),
    enabled: validId(projectId),
  });
}

/** §3/§6 burndown of open top-level tasks (used by the reports tab). */
export function useBurndown(projectId: number) {
  return useQuery({
    queryKey: qk.analytics.burndown(projectId),
    queryFn: () => analyticsApi.burndown(projectId),
    enabled: validId(projectId),
  });
}

/** §3 deadline planner — only runs for an explicit target date (Monte Carlo is not free). */
export function usePlan(
  projectId: number,
  target: { by: string; confidence: PlanConfidence } | null,
) {
  return useQuery({
    queryKey: qk.analytics.plan(projectId, target?.by ?? '', target?.confidence ?? 85),
    queryFn: () => analyticsApi.plan(projectId, target!.by, target!.confidence),
    enabled: validId(projectId) && target !== null,
  });
}
