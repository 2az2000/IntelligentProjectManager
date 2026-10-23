import type { Db } from '../../shared/db/prisma';
import { ProjectService, type TemplateApply, type UserLookup } from './application/project.service';
import { SavedViewService } from './application/saved-view.service';
import { PrismaProjectRepository } from './infrastructure/prisma-project.repository';
import { PrismaSavedViewRepository } from './infrastructure/prisma-saved-view.repository';
import { createProjectRouter, createTeamRouter } from './http/project.routes';
import { createSavedViewRouter } from './http/saved-view.routes';

export function createProjectsModule(deps: {
  db: Db;
  users: UserLookup;
  /** Tasks/scheduling capability for §11 templates — wired by the composition root. */
  templateApply?: TemplateApply;
}) {
  const service = new ProjectService(new PrismaProjectRepository(deps.db), deps.users);
  if (deps.templateApply) service.templateApply = deps.templateApply;
  const savedViews = new SavedViewService(new PrismaSavedViewRepository(deps.db), service);
  return {
    service,
    router: createProjectRouter(service),
    teamRouter: createTeamRouter(service),
    savedViewsRouter: createSavedViewRouter(savedViews),
  };
}

export { PROJECT_TEMPLATES, findTemplate } from './templates';
export type { ProjectTemplate, TemplateTask } from './templates';

export type { ProjectService } from './application/project.service';
export { SAVED_VIEW_LIMIT } from './application/saved-view.service';
export type { SavedViewFilters } from './application/saved-view.service';
export type { Project } from './domain/project.entity';
export { PROJECT_ROLES, hasRole } from './domain/project-role';
export { addMemberBody, createProjectBody, updateMemberBody, updateProjectBody } from './http/project.schemas';
export type { ProjectRole } from './domain/project-role';
