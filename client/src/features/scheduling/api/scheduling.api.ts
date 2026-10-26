import { apiClient } from '@/lib/api-client';
import type { BaselineSummary, BaselineVariance, DependencyView, ScheduleResult } from '../types';

export interface CreateDependencyInput {
  predecessorId: number;
  successorId: number;
}

export const schedulingApi = {
  getSchedule: async (projectId: number): Promise<ScheduleResult> =>
    (await apiClient.get<ScheduleResult>(`/projects/${projectId}/schedule`)).data,
  getTaskSchedule: async (taskId: number): Promise<ScheduleResult> =>
    (await apiClient.get<ScheduleResult>(`/tasks/${taskId}/schedule`)).data,
  applySchedule: async (projectId: number): Promise<ScheduleResult> =>
    (await apiClient.post<ScheduleResult>(`/projects/${projectId}/schedule/apply`)).data,

  listDependencies: async (projectId: number): Promise<DependencyView[]> =>
    (await apiClient.get<DependencyView[]>(`/projects/${projectId}/dependencies`)).data,
  createDependency: async (projectId: number, input: CreateDependencyInput): Promise<DependencyView> =>
    (await apiClient.post<DependencyView>(`/projects/${projectId}/dependencies`, input)).data,
  removeDependency: async (projectId: number, predecessorId: number, successorId: number): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/dependencies/${predecessorId}/${successorId}`);
  },

  /** §2.2 captured plans, newest first. */
  listBaselines: async (projectId: number): Promise<BaselineSummary[]> =>
    (await apiClient.get<BaselineSummary[]>(`/projects/${projectId}/baselines`)).data,
  createBaseline: async (projectId: number, name?: string): Promise<BaselineSummary> =>
    (await apiClient.post<BaselineSummary>(`/projects/${projectId}/baselines`, { name })).data,
  baselineVariance: async (projectId: number, baselineId: number): Promise<BaselineVariance> =>
    (
      await apiClient.get<BaselineVariance>(
        `/projects/${projectId}/baselines/${baselineId}/variance`,
      )
    ).data,
};
