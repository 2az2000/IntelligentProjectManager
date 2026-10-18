import type { Db } from '../../shared/db/prisma';
import { StatusService, type ProjectAccess } from './status.service';
import { createStatusRouter } from './status.routes';

export function createStatusesModule(deps: { db: Db; projects: ProjectAccess }) {
  const service = new StatusService(deps.db, deps.projects);
  return { service, router: createStatusRouter(service) };
}

export {
  DEFAULT_STATUSES,
  STATUS_CATEGORIES,
  StatusService,
  type ProjectAccess as StatusProjectAccess,
  type StatusCategory,
  type StatusInput,
  type StatusPatch,
  type StatusView,
} from './status.service';
