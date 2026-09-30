import type { Db } from '../../shared/db/prisma';
import { ProjectService, type UserLookup } from './application/project.service';
import { PrismaProjectRepository } from './infrastructure/prisma-project.repository';
import { createProjectRouter, createTeamRouter } from './http/project.routes';

export function createProjectsModule(deps: { db: Db; users: UserLookup }) {
  const service = new ProjectService(new PrismaProjectRepository(deps.db), deps.users);
  return { service, router: createProjectRouter(service), teamRouter: createTeamRouter(service) };
}

export type { ProjectService } from './application/project.service';
export type { Project } from './domain/project.entity';
export { PROJECT_ROLES, hasRole } from './domain/project-role';
export type { ProjectRole } from './domain/project-role';
