import type { ProjectDto, ProjectRole, UserSummary } from '@managesys/contracts';

/** Roles, their ranking and the response shape all come from `@managesys/contracts`. */
export {
  ASSIGNABLE_ROLES,
  PROJECT_ROLES,
  hasRole,
  type AssignableRole,
  type ProjectRole,
} from '@managesys/contracts';
export type { UserSummary } from '@managesys/contracts';

/** Mirrors ProjectDto in docs/02-API-CONTRACT.md (shared type). */
export type Project = ProjectDto;

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

/** §Imp #4 — workload heatmap: one member's open-work hours per week (server-spread). */
export interface TeamWorkloadCell {
  hours: number;
  /** Open tasks behind the cell's hours, heaviest share first. */
  tasks: {
    id: number;
    title: string;
    projectId: number;
    projectName: string;
    estimateHours: number | null;
    dueDate: string | null;
  }[];
}

export interface TeamWorkload {
  capacityHoursPerWeek: number;
  /** Saturday-opened 7-day windows, index-aligned with every member's cells. */
  weeks: { start: string; end: string }[];
  members: {
    user: UserSummary & { email: string };
    capacityHoursPerWeek: number | null;
    cells: TeamWorkloadCell[];
  }[];
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
