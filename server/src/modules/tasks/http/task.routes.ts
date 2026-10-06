import { Router } from 'express';
import { currentUserId, requireAuth } from '../../../shared/auth/require-auth';
import { handle } from '../../../shared/http/handle';
import type { TaskService } from '../application/task.service';
import { toTaskDetailDto, toTaskDto } from './task.dto';
import {
  calendarQuery,
  createTaskBody,
  listTasksQuery,
  moveTaskBody,
  myTasksQuery,
  projectIdParams,
  taskIdParams,
  trashRestoreParams,
  updateTaskBody,
} from './task.schemas';

/** Mounted at /projects/:projectId/tasks */
export function createProjectTasksRouter(tasks: TaskService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    handle({ params: projectIdParams, query: listTasksQuery }, async ({ params, query }, req, res) => {
      const list = await tasks.list(currentUserId(req), params.projectId, query);
      res.json(list.map(toTaskDto));
    }),
  );

  // §11 recycling bin: deleted tasks + restore (mounted at /projects/:projectId/tasks).
  router.get(
    '/trash',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      const list = await tasks.listTrash(currentUserId(req), params.projectId);
      res.json(list.map(toTaskDto));
    }),
  );
  router.post(
    '/trash/:taskId/restore',
    handle({ params: trashRestoreParams }, async ({ params }, req, res) => {
      res.json(toTaskDto(await tasks.restore(currentUserId(req), params.taskId)));
    }),
  );

  router.post(
    '/',
    handle({ params: projectIdParams, body: createTaskBody }, async ({ params, body }, req, res) => {
      const task = await tasks.create(currentUserId(req), { ...body, projectId: params.projectId });
      res.status(201).json(toTaskDto(task));
    }),
  );

  return router;
}

/** Mounted at /tasks */
export function createTasksRouter(tasks: TaskService): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/:taskId',
    handle({ params: taskIdParams }, async ({ params }, req, res) => {
      res.json(toTaskDetailDto(await tasks.get(currentUserId(req), params.taskId)));
    }),
  );

  router.patch(
    '/:taskId',
    handle({ params: taskIdParams, body: updateTaskBody }, async ({ params, body }, req, res) => {
      res.json(toTaskDto(await tasks.update(currentUserId(req), params.taskId, body)));
    }),
  );

  router.post(
    '/:taskId/move',
    handle({ params: taskIdParams, body: moveTaskBody }, async ({ params, body }, req, res) => {
      res.json(toTaskDto(await tasks.move(currentUserId(req), params.taskId, body)));
    }),
  );

  router.delete(
    '/:taskId',
    handle({ params: taskIdParams }, async ({ params }, req, res) => {
      await tasks.remove(currentUserId(req), params.taskId);
      res.status(204).end();
    }),
  );

  return router;
}

/** Mounted at /me */
export function createMyTasksRouter(tasks: TaskService): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/tasks',
    handle({ query: myTasksQuery }, async ({ query }, req, res) => {
      const list = await tasks.listForUser(currentUserId(req), { includeDone: query.includeDone });
      res.json(list.map(toTaskDto));
    }),
  );

  router.get(
    '/calendar',
    handle({ query: calendarQuery }, async ({ query }, req, res) => {
      const list = await tasks.listForUser(currentUserId(req), {
        includeDone: true,
        dueFrom: query.from,
        dueTo: query.to,
        anyAssignee: query.scope === 'all',
      });
      res.json(list.map(toTaskDto));
    }),
  );

  return router;
}
