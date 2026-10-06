import type { Db } from '../../shared/db/prisma';
import { AiService, type ProjectAccess } from './ai.service';
import { createAiRouter } from './ai.routes';

export function createAiModule(deps: { db: Db; projects: ProjectAccess }) {
  const service = new AiService(deps.db, deps.projects);
  return { service, aiRouter: createAiRouter(service) };
}

export type { AiService } from './ai.service';
export { enrichTaskBody, projectIdParams } from './ai.schemas';
