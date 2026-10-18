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

/** One row of the daily report: a task of mine that is due today or already late. */
export interface DigestTask {
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
  /** Whole days until due (negative while overdue, null without a due date). */
  daysUntilDue: number | null;
}

/** Open/overdue counts for one of my projects — the "where is the pile-up" view. */
export interface DigestProject {
  projectId: number;
  projectName: string;
  open: number;
  overdue: number;
}

/**
 * The daily-digest report. Mirrors the server payload exactly (same object the 08:00 email is
 * rendered from), so the modal and the mail always agree.
 */
export interface DashboardDigest {
  generatedAt: string;
  open: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  /** Finished in the last 24h. */
  completedSinceYesterday: number;
  /** Mine, not done, already started (IN_PROGRESS or REVIEW). */
  inProgress: number;
  /** Most overdue task's age in days; 0 when no task is overdue. */
  overdueByDays: number;
  /** Open tasks due today or already overdue, nearest first. */
  tasks: DigestTask[];
  perProject: DigestProject[];
}

export const dashboardApi = {
  summary: async (): Promise<DashboardSummary> =>
    (await apiClient.get<DashboardSummary>('/dashboard/summary')).data,
  digest: async (): Promise<DashboardDigest> =>
    (await apiClient.get<DashboardDigest>('/dashboard/digest')).data,
};
