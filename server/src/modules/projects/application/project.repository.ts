import type { Project, ProjectChanges, ValidNewProject } from '../domain/project.entity';
import type { ProjectRole } from '../domain/project-role';
import type { CellTasks, WeekWindow } from './workload';

export interface UserSummary {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface ProjectStats {
  total: number;
  done: number;
  overdue: number;
  /** §3: parents whose progress is derived from their subtasks (done/total). */
  subtaskProgress: { taskId: number; done: number; total: number }[];
}

export interface ProjectView {
  project: Project;
  role: ProjectRole;
  owner: UserSummary;
  memberCount: number;
  stats: ProjectStats;
}

export interface MemberView {
  user: UserSummary & { email: string };
  role: ProjectRole;
  joinedAt: Date;
  openTasks: number;
  openPoints: number;
  /** Specialties used by AI assignee suggestions. */
  skills: string[];
  /** §3: per-member weekly capacity (null = server default) — drives workload & leveling. */
  capacityHoursPerWeek: number | null;
  /** §6: open estimate hours summed over this member's unfinished tasks. */
  openEstimateHours: number;
}

export interface TeammateView {
  user: UserSummary & { email: string };
  projectCount: number;
  openTasks: number;
  openPoints: number;
  overdueTasks: number;
}

/** §Imp #4: one member's heat row — hours + contributing tasks, aligned with the weeks. */
export interface TeamWorkloadView {
  user: UserSummary & { email: string };
  /** Index-aligned with the requested weeks. */
  hours: number[];
  /** Open tasks (with their weekly hour share) per week, heaviest first. */
  cells: CellTasks[][];
  /** Per-member weekly capacity override (null = server default WEEKLY_CAPACITY). */
  capacityHoursPerWeek: number | null;
}

export interface ProjectRepository {
  /** Creates the project and makes its owner an OWNER member (single transaction). */
  create(data: ValidNewProject): Promise<Project>;
  findById(id: number): Promise<Project | null>;
  update(id: number, patch: ProjectChanges): Promise<void>;
  softDelete(id: number, now: Date): Promise<void>;
  /** Projects the user is a member of, with role, owner, member count and task stats. */
  listViewsForUser(userId: number, now: Date, projectId?: number): Promise<ProjectView[]>;
  findRole(projectId: number, userId: number): Promise<ProjectRole | null>;
  projectIdsForUser(userId: number): Promise<number[]>;
  listMembers(projectId: number): Promise<MemberView[]>;
  addMember(projectId: number, userId: number, role: ProjectRole, skills: string[]): Promise<void>;
  updateMember(
    projectId: number,
    userId: number,
    patch: { role?: ProjectRole; skills?: string[]; capacityHoursPerWeek?: number | null; hourlyRate?: number | null },
  ): Promise<void>;
  removeMember(projectId: number, userId: number): Promise<void>;
  /** Everyone who shares at least one project with the user, with workload across those projects. */
  teamForUser(userId: number, now: Date): Promise<TeammateView[]>;
  /** Open-task estimate hours spread over `weeks` for everyone sharing a project with `userId`. */
  teamWorkloadForUser(userId: number, weeks: WeekWindow[], now: Date): Promise<TeamWorkloadView[]>;
}
