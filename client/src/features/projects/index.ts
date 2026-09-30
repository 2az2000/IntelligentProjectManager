export { CreateProjectDialog } from './components/create-project-dialog';
export { ProjectGrid } from './components/project-grid';
export { ProjectHeader } from './components/project-header';
export { ProjectSettings } from './components/project-settings';
export { TeamGrid } from './components/team-grid';
export {
  useProjects,
  useProject,
  useCreateProject,
  useProjectMembers,
  useTeam,
} from './hooks/use-projects';
export { hasRole } from './types';
export type { Project, ProjectRole, ProjectMember } from './types';
