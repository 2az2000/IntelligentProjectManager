import type {
  MemberView,
  ProjectStats,
  ProjectView,
  TeammateView,
  UserSummary,
} from '../application/project.repository';
import type { ProjectRole } from '../domain/project-role';

export interface ProjectDto {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: number;
  owner: UserSummary;
  myRole: ProjectRole;
  memberCount: number;
  stats: ProjectStats;
  createdAt: string;
  updatedAt: string;
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toProjectDto(view: ProjectView): ProjectDto {
  const p = view.project.toJSON();
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    startDate: iso(p.startDate),
    endDate: iso(p.endDate),
    ownerId: p.ownerId,
    owner: view.owner,
    myRole: view.role,
    memberCount: view.memberCount,
    stats: view.stats,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const toMemberDto = (m: MemberView) => ({
  user: m.user,
  role: m.role,
  joinedAt: m.joinedAt.toISOString(),
  openTasks: m.openTasks,
  openPoints: m.openPoints,
});

export const toTeammateDto = (t: TeammateView) => ({ ...t });
