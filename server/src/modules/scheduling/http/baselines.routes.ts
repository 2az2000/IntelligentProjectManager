import { Router } from 'express';
import { z } from 'zod';
import { createBaselinePayloadSchema } from '@managesys/contracts';
import { currentUserId, requireAuth } from '../../../shared/auth/require-auth';
import { handle } from '../../../shared/http/handle';
import type { BaselineService } from '../application/baseline.service';
import { baselinePathParams, projectIdParams } from './scheduling.schemas';

/** Mounted at /projects/:projectId/baselines */
export function createProjectBaselinesRouter(baselines: BaselineService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await baselines.list(currentUserId(req), params.projectId));
    }),
  );

  router.post(
    '/',
    handle(
      { params: projectIdParams, body: createBaselinePayloadSchema(z) },
      async ({ params, body }, req, res) => {
        res.status(201).json(await baselines.create(currentUserId(req), params.projectId, body.name));
      },
    ),
  );

  router.get(
    '/:baselineId/variance',
    handle(
      { params: projectIdParams.merge(baselinePathParams) },
      async ({ params }, req, res) => {
        res.json(
          await baselines.variance(currentUserId(req), params.projectId, params.baselineId),
        );
      },
    ),
  );

  return router;
}
