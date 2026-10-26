import type { Db } from '../../shared/db/prisma';
import type { ProjectAccess } from './application/scheduling.service';
import { DependencyService, ScheduleService } from './application/scheduling.service';
import { BaselineService } from './application/baseline.service';
import { AnalyticsService } from './application/analytics.service';
import {
  createProjectDependenciesRouter,
  createProjectScheduleRouter,
  createTaskScheduleRouter,
} from './http/scheduling.routes';
import { createAnalyticsRouter, createHolidaysRouter } from './http/analytics.routes';
import { createProjectBaselinesRouter } from './http/baselines.routes';

export function createSchedulingModule(deps: { db: Db; projects: ProjectAccess }) {
  const schedules = new ScheduleService(deps.db, deps.projects);
  const dependencies = new DependencyService(deps.db, deps.projects);
  const analytics = new AnalyticsService(deps.db, deps.projects);
  const baselines = new BaselineService(deps.db, deps.projects);
  return {
    schedules,
    dependencies,
    analytics,
    baselines,
    projectScheduleRouter: createProjectScheduleRouter(schedules),
    taskScheduleRouter: createTaskScheduleRouter(schedules),
    dependenciesRouter: createProjectDependenciesRouter(dependencies),
    baselinesRouter: createProjectBaselinesRouter(baselines),
    analyticsRouter: createAnalyticsRouter(analytics),
    holidaysRouter: createHolidaysRouter(),
  };
}

export { buildSchedule } from './application/schedule';
export { findDependencyDateConflicts } from './domain/date-conflicts';
export type { TaskDateConflict } from './domain/date-conflicts';
export type {
  ScheduleResult,
  ScheduledTask,
  ScheduleTask,
  ScheduleEdge,
} from './application/schedule';
