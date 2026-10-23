import type { Db } from '../../shared/db/prisma';
import { AiService, type ProjectAccess } from './ai.service';
import { createAiRouter, createTaskAiRouter } from './ai.routes';

export function createAiModule(deps: { db: Db; projects: ProjectAccess }) {
  const service = new AiService(deps.db, deps.projects);
  return { service, aiRouter: createAiRouter(service), taskAiRouter: createTaskAiRouter(service) };
}

export type { AiService } from './ai.service';
export { breakdownBody, chatBody, enrichTaskBody, projectIdParams } from './ai.schemas';
