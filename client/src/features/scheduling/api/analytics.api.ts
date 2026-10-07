import { apiClient } from '@/lib/api-client';
import type { BurndownResult, ForecastResult, RiskResult } from '../analytics-types';

export const analyticsApi = {
  /** GET /projects/:id/forecast — Monte Carlo percentiles (§3). */
  forecast: async (projectId: number): Promise<ForecastResult> =>
    (await apiClient.get<ForecastResult>(`/projects/${projectId}/forecast`)).data,

  /** GET /projects/:id/risks — risk-sorted tasks with reasons (§3). */
  risks: async (projectId: number): Promise<RiskResult> =>
    (await apiClient.get<RiskResult>(`/projects/${projectId}/risks`)).data,

  /** GET /projects/:id/burndown — remaining work over time (§3). */
  burndown: async (projectId: number): Promise<BurndownResult> =>
    (await apiClient.get<BurndownResult>(`/projects/${projectId}/burndown`)).data,
};
