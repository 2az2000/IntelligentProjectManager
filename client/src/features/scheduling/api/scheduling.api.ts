import { apiClient } from '@/lib/api-client';
import type { DependencyView, ScheduleResult } from '../types';

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
};
