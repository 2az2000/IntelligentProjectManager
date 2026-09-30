import { apiClient } from '@/lib/api-client';
import type { TaskPriority, TaskStatus } from '@/features/tasks';

export interface DashboardSummary {
  projectCount: number;
  myOpenTasks: number;
  overdue: number;
  dueThisWeek: number;
  completedThisWeek: number;
  byStatus: Record<TaskStatus, number>;
  upcoming: {
    id: number;
    title: string;
    dueDate: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    project: { id: number; name: string };
  }[];
  recentProjects: { id: number; name: string; updatedAt: string }[];
}

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> =>
    (await apiClient.get<DashboardSummary>('/dashboard/summary')).data,
};
