import type { ProjectDto } from '@managesys/contracts';
import type { MemberView, ProjectView, TeamWorkloadView, TeammateView } from '../application/project.repository';

// The response shape is shared with the client (`@managesys/contracts`).
export type { ProjectDto };

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
    columnLimits: p.columnLimits,
    stats: {
      total: view.stats.total,
      done: view.stats.done,
      overdue: view.stats.overdue,
      subtaskProgress: view.stats.subtaskProgress ?? [],
    },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const toMemberDto = (m: MemberView) => ({
  user: m.user,
  role: m.role,
  skills: m.skills,
  joinedAt: m.joinedAt.toISOString(),
  openTasks: m.openTasks,
  openPoints: m.openPoints,
  capacityHoursPerWeek: m.capacityHoursPerWeek,
  openEstimateHours: m.openEstimateHours,
});

export const toTeammateDto = (t: TeammateView) => ({ ...t });

/** §Imp #4: heatmap row — hours/tasks stay index-shaped weeks from the service. */
export const toTeamWorkloadDto = (m: TeamWorkloadView) => ({
  user: m.user,
  capacityHoursPerWeek: m.capacityHoursPerWeek,
  cells: m.cells.map((weekTasks, weekIndex) => ({
    hours: Math.round((m.hours[weekIndex] ?? 0) * 10) / 10,
    tasks: weekTasks.map((t) => ({ ...t, dueDate: iso(t.dueDate) })),
  })),
});
