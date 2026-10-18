import type { Db } from '../../shared/db/prisma';
import type { StatusService } from '../statuses';
import { TaskService, type ProjectAccess } from './application/task.service';
import { BulkService } from './application/bulk.service';
import { TimeTrackingService } from './application/time-tracking.service';
import { PrismaTaskRepository } from './infrastructure/prisma-task.repository';
import { createMyTasksRouter, createProjectTasksRouter, createTasksRouter } from './http/task.routes';
import { createBulkRouter } from './http/bulk.routes';
import {
  createMyTimeRouter,
  createProjectCostRouter,
  createTaskTimeRouter,
} from './http/time-tracking.routes';

export function createTasksModule(deps: {
  db: Db;
  projects: ProjectAccess;
  /** Per-project workflow columns — a task's status key only means something inside its project. */
  statuses: StatusService;
}) {
  const service = new TaskService(new PrismaTaskRepository(deps.db), deps.projects, deps.statuses);
  const time = new TimeTrackingService(deps.db, deps.projects);
  const bulk = new BulkService(deps.db, deps.projects, deps.statuses);
  return {
    service,
    time,
    bulk,
    projectTasksRouter: createProjectTasksRouter(service),
    bulkRouter: createBulkRouter(bulk),
    tasksRouter: createTasksRouter(service),
    myTasksRouter: createMyTasksRouter(service),
    taskTimeRouter: createTaskTimeRouter(time),
    myTimeRouter: createMyTimeRouter(time),
    projectCostRouter: createProjectCostRouter(time),
  };
}

export type { TaskService } from './application/task.service';
export { TASK_STATUSES, TASK_PRIORITIES } from './domain/task.entity';
export { createTaskBody, listTasksQuery, moveTaskBody, updateTaskBody } from './http/task.schemas';
export { manualTimeBody } from './http/time-tracking.routes';
export type { TaskStatus, TaskPriority } from './domain/task.entity';
