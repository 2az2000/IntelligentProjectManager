import type { Db } from '../../shared/db/prisma';
import { LabelService, type ProjectAccess } from './label.service';
import { createLabelRouter } from './label.routes';

export function createLabelsModule(deps: { db: Db; projects: ProjectAccess }) {
  const service = new LabelService(deps.db, deps.projects);
  return { service, router: createLabelRouter(service) };
}

export { LABEL_ICONS, type LabelIcon, type LabelInput, type LabelView } from './label.service';
