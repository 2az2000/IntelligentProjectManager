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

export interface DashboardDigest {
  generatedAt: string;
  open: number;
  overdue: number;
  dueToday: number;
  /** Open tasks due today or already overdue, nearest first. */
  tasks: {
    id: number;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    projectId: number;
    projectName: string;
    overdue: boolean;
    /** Already-overdue tasks: how many whole days past due (>= 1 when overdue). */
    overdueByDays: number;
  }[];
  /** Most overdue task's age in days; 0 when no task is overdue. */
  overdueByDays: number;
}

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> =>
    (await apiClient.get<DashboardSummary>('/dashboard/summary')).data,
  digest: async (): Promise<DashboardDigest> =>
    (await apiClient.get<DashboardDigest>('/dashboard/digest')).data,
  /** Latest digest from the 08:00 email run — drives stale refresh in the digest dialog. */
  latest: async (): Promise<DashboardDigest> =>
    (await apiClient.get<DashboardDigest>('/dashboard/digest/latest')).data,
};

