import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth } from '../../../shared/auth/require-auth';
import { handle } from '../../../shared/http/handle';
import type { TimeTrackingService } from '../application/time-tracking.service';
import { taskIdParams } from './task.schemas';

const id = z.coerce.number().int().positive();

export const projectIdParams = z.object({ projectId: id });

export const manualTimeBody = z
  .object({
    startedAt: z.coerce.date(),
    minutes: z.number().int().min(1).max(1440),
  })
  .strict();

/** Project budget/rate settings (ADMIN+ only). */
export const budgetBody = z
  .object({
    hourlyRate: z.number().min(0).max(1_000_000).nullable().optional(),
    budgetAmount: z.number().min(0).max(1_000_000_000).nullable().optional(),
  })
  .strict()
  .refine((b) => b.hourlyRate !== undefined || b.budgetAmount !== undefined, 'At least one field is required');

/** Mounted at /tasks/:taskId/time */
export function createTaskTimeRouter(time: TimeTrackingService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.post(
    '/start',
    handle({ params: taskIdParams }, async ({ params }, req, res) => {
      res.status(201).json(await time.start(currentUserId(req), params.taskId));
    }),
  );

  router.post(
    '/stop',
    handle({ params: taskIdParams }, async ({ params }, req, res) => {
      res.json(await time.stop(currentUserId(req), params.taskId));
    }),
  );

  router.post(
    '/manual',
    handle(
      { params: taskIdParams, body: manualTimeBody },
      async ({ params, body }, req, res) => {
        res.status(201).json(await time.addManual(currentUserId(req), params.taskId, body));
      },
    ),
  );

  router.get(
    '/',
    handle({ params: taskIdParams }, async ({ params }, req, res) => {
      res.json(await time.listForTask(currentUserId(req), params.taskId));
    }),
  );

  return router;
}

/** Mounted at /me — personal timer state + weekly summary. */
export function createMyTimeRouter(time: TimeTrackingService): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/timer',
    handle({}, async (_input, req, res) => {
      res.json(await time.openTimer(currentUserId(req)));
    }),
  );

  router.get(
    '/time-summary',
    handle({}, async (_input, req, res) => {
      res.json(await time.weeklySummary(currentUserId(req)));
    }),
  );

  return router;
}

/** Mounted at /projects/:projectId — cost report (GET) + budget settings (PATCH). */
export function createProjectCostRouter(time: TimeTrackingService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/cost',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await time.projectCost(currentUserId(req), params.projectId));
    }),
  );

  return router;
}
