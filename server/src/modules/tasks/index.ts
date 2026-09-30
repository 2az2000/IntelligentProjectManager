import type { Db } from '../../shared/db/prisma';
import { TaskService, type ProjectAccess } from './application/task.service';
import { PrismaTaskRepository } from './infrastructure/prisma-task.repository';
import { createMyTasksRouter, createProjectTasksRouter, createTasksRouter } from './http/task.routes';

export function createTasksModule(deps: { db: Db; projects: ProjectAccess }) {
  const service = new TaskService(new PrismaTaskRepository(deps.db), deps.projects);
  return {
    service,
    projectTasksRouter: createProjectTasksRouter(service),
    tasksRouter: createTasksRouter(service),
    myTasksRouter: createMyTasksRouter(service),
  };
}

export type { TaskService } from './application/task.service';
export { TASK_STATUSES, TASK_PRIORITIES } from './domain/task.entity';
export type { TaskStatus, TaskPriority } from './domain/task.entity';
