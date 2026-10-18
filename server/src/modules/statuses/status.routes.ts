import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import { STATUS_CATEGORIES, type StatusService } from './status.service';

const id = z.coerce.number().int().positive();
const projectParams = z.object({ projectId: id });
const statusParams = z.object({ projectId: id, statusId: id });

/** `#rrggbb`, lower-cased so two spellings can't look like two colours. */
const color = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'color must be a #rrggbb hex value')
  .transform((value) => value.toLowerCase());

const label = z.string().trim().min(1).max(40);
const category = z.enum(STATUS_CATEGORIES);
const key = z.string().trim().min(1).max(40);

const createBody = z.object({ label, color, category, afterKey: key.optional() }).strict();
const updateBody = z
  .object({ label: label.optional(), color: color.optional(), category: category.optional() })
  .strict()
  .refine(
    (body) => body.label !== undefined || body.color !== undefined || body.category !== undefined,
    'At least one field is required',
  );
const reorderBody = z.object({ keys: z.array(key).min(1).max(50) }).strict();
const removeQuery = z.object({ moveToKey: key.optional() });

/** Mounted at /projects/:projectId/statuses */
export function createStatusRouter(statuses: StatusService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    handle({ params: projectParams }, async ({ params }, req, res) => {
      res.json(await statuses.list(currentUserId(req), params.projectId));
    }),
  );

  router.post(
    '/',
    handle({ params: projectParams, body: createBody }, async ({ params, body }, req, res) => {
      res.status(201).json(await statuses.create(currentUserId(req), params.projectId, body));
    }),
  );

  router.post(
    '/reorder',
    handle({ params: projectParams, body: reorderBody }, async ({ params, body }, req, res) => {
      res.json(await statuses.reorder(currentUserId(req), params.projectId, body.keys));
    }),
  );

  router.patch(
    '/:statusId',
    handle(
      { params: statusParams, body: updateBody },
      async ({ params, body }, req, res) => {
        res.json(await statuses.update(currentUserId(req), params.projectId, params.statusId, body));
      },
    ),
  );

  router.delete(
    '/:statusId',
    handle({ params: statusParams, query: removeQuery }, async ({ params, query }, req, res) => {
      await statuses.remove(currentUserId(req), params.projectId, params.statusId, query.moveToKey);
      res.status(204).end();
    }),
  );

  return router;
}
