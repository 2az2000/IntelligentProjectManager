export const PROJECT_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];
export const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const RANK: Record<ProjectRole, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };
/** VIEWER < MEMBER < ADMIN < OWNER */
export const hasRole = (actual: ProjectRole, required: ProjectRole) => RANK[actual] >= RANK[required];

export interface UserSummary {
  id: number;
  name: string;
  avatarUrl: string | null;
}

/** Mirrors ProjectDto in docs/02-API-CONTRACT.md */
export interface Project {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: number;
  owner: UserSummary;
  myRole: ProjectRole;
  memberCount: number;
  stats: {
    total: number;
    done: number;
    overdue: number;
    /** §3 per-parent subtask progress (done/total) for parent cards. */
    subtaskProgress: { taskId: number; done: number; total: number }[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  user: UserSummary & { email: string };
  role: ProjectRole;
  /** Specialties (frontend, backend, marketing…) — used by AI assignee suggestions. */
  skills: string[];
  joinedAt: string;
  openTasks: number;
  openPoints: number;
  /** §3 weekly capacity in working hours (null = server default). */
  capacityHoursPerWeek: number | null;
  /** §6 open estimate hours summed over unfinished tasks. */
  openEstimateHours: number;
}

export interface Teammate {
  user: UserSummary & { email: string };
  projectCount: number;
  openTasks: number;
  openPoints: number;
  overdueTasks: number;
}

/** §11 built-in project template (mirrors server/templates.ts). */
export interface ProjectTemplate {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  tasks: {
    title: string;
    description?: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    estimateHours?: number;
    dependsOn?: string[];
  }[];
}
