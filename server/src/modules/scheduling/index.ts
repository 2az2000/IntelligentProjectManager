import type { Db } from '../../shared/db/prisma';
import type { ProjectAccess } from './application/scheduling.service';
import { DependencyService, ScheduleService } from './application/scheduling.service';
import {
  createProjectDependenciesRouter,
  createProjectScheduleRouter,
  createTaskScheduleRouter,
} from './http/scheduling.routes';

export function createSchedulingModule(deps: { db: Db; projects: ProjectAccess }) {
  const schedules = new ScheduleService(deps.db, deps.projects);
  const dependencies = new DependencyService(deps.db, deps.projects);
  return {
    schedules,
    dependencies,
    projectScheduleRouter: createProjectScheduleRouter(schedules),
    taskScheduleRouter: createTaskScheduleRouter(schedules),
    dependenciesRouter: createProjectDependenciesRouter(dependencies),
  };
}

export { buildSchedule } from './application/schedule';
export type {
  ScheduleResult,
  ScheduledTask,
  ScheduleTask,
  ScheduleEdge,
} from './application/schedule';
