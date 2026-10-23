import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth } from '../../../shared/auth/require-auth';
import { handle } from '../../../shared/http/handle';
import {
  SAVED_VIEW_GROUPS,
  type SavedView,
  type SavedViewService,
} from '../application/saved-view.service';

const id = z.coerce.number().int().positive();

const viewIdParams = z.object({ projectId: id, viewId: id });
const projectParams = z.object({ projectId: id });

/** Kept in sync with the client's TaskFilters; unknown keys are rejected, not ignored. */
const filters = z
  .object({
    search: z.string().trim().min(1).max(100).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assigneeId: z.number().int().min(0).optional(),
    groupBy: z.enum(SAVED_VIEW_GROUPS).optional(),
  })
  .strict();

const createBody = z.object({ name: z.string().trim().min(1).max(40), filters }).strict();
const updateBody = z
  .object({ name: z.string().trim().min(1).max(40), filters })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');

const toDto = (view: SavedView) => ({
  id: view.id,
  projectId: view.projectId,
  name: view.name,
  filters: view.filters,
  createdAt: view.createdAt.toISOString(),
  updatedAt: view.updatedAt.toISOString(),
});

/** Mounted at /projects/:projectId/views — always the caller's own views. */
export function createSavedViewRouter(views: SavedViewService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    handle({ params: projectParams }, async ({ params }, req, res) => {
      res.json((await views.list(currentUserId(req), params.projectId)).map(toDto));
    }),
  );

  router.post(
    '/',
    handle({ params: projectParams, body: createBody }, async ({ params, body }, req, res) => {
      res.status(201).json(toDto(await views.create(currentUserId(req), params.projectId, body)));
    }),
  );

  router.patch(
    '/:viewId',
    handle({ params: viewIdParams, body: updateBody }, async ({ params, body }, req, res) => {
      res.json(toDto(await views.update(currentUserId(req), params.projectId, params.viewId, body)));
    }),
  );

  router.delete(
    '/:viewId',
    handle({ params: viewIdParams }, async ({ params }, req, res) => {
      await views.remove(currentUserId(req), params.projectId, params.viewId);
      res.status(204).end();
    }),
  );

  return router;
}
