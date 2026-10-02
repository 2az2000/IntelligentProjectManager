import { Router } from 'express';
import { currentUserId, requireAuth } from '../../../shared/auth/require-auth';
import { handle } from '../../../shared/http/handle';
import type { DependencyService, ScheduleService } from '../application/scheduling.service';
import {
  dependencyBody,
  dependencyPathParams,
  projectIdParams,
  scheduleTaskParams,
} from './scheduling.schemas';

/** Mounted at /projects/:projectId/schedule */
export function createProjectScheduleRouter(schedules: ScheduleService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await schedules.getSchedule(currentUserId(req), params.projectId));
    }),
  );

  router.post(
    '/apply',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await schedules.applySchedule(currentUserId(req), params.projectId));
    }),
  );

  return router;
}

/** Mounted at /tasks/:taskId/schedule */
export function createTaskScheduleRouter(schedules: ScheduleService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    handle({ params: scheduleTaskParams }, async ({ params }, req, res) => {
      res.json(await schedules.getTaskSchedule(currentUserId(req), params.taskId));
    }),
  );

  return router;
}

/** Mounted at /projects/:projectId/dependencies */
export function createProjectDependenciesRouter(dependencies: DependencyService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await dependencies.list(currentUserId(req), params.projectId));
    }),
  );

  router.post(
    '/',
    handle({ params: projectIdParams, body: dependencyBody }, async ({ body }, req, res) => {
      res.status(201).json(
        await dependencies.create(currentUserId(req), body.predecessorId, body.successorId),
      );
    }),
  );

  router.delete(
    '/:predecessorId/:successorId',
    handle(
      {
        params: projectIdParams.merge(dependencyPathParams),
      },
      async ({ params }, req, res) => {
        await dependencies.remove(
          currentUserId(req),
          params.predecessorId,
          params.successorId,
        );
        res.status(204).end();
      },
    ),
  );

  return router;
}
