import type { Db } from '../../shared/db/prisma';
import type { ProjectAccess } from './application/scheduling.service';
import { DependencyService, ScheduleService } from './application/scheduling.service';
import { AnalyticsService } from './application/analytics.service';
import {
  createProjectDependenciesRouter,
  createProjectScheduleRouter,
  createTaskScheduleRouter,
} from './http/scheduling.routes';
import { createAnalyticsRouter, createHolidaysRouter } from './http/analytics.routes';

export function createSchedulingModule(deps: { db: Db; projects: ProjectAccess }) {
  const schedules = new ScheduleService(deps.db, deps.projects);
  const dependencies = new DependencyService(deps.db, deps.projects);
  const analytics = new AnalyticsService(deps.db, deps.projects);
  return {
    schedules,
    dependencies,
    analytics,
    projectScheduleRouter: createProjectScheduleRouter(schedules),
    taskScheduleRouter: createTaskScheduleRouter(schedules),
    dependenciesRouter: createProjectDependenciesRouter(dependencies),
    analyticsRouter: createAnalyticsRouter(analytics),
    holidaysRouter: createHolidaysRouter(),
  };
}

export { buildSchedule } from './application/schedule';
export type {
  ScheduleResult,
  ScheduledTask,
  ScheduleTask,
  ScheduleEdge,
} from './application/schedule';
