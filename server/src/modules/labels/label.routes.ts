import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth } from '../../shared/auth/require-auth';
import { handle } from '../../shared/http/handle';
import { LABEL_ICONS, type LabelService } from './label.service';

const id = z.coerce.number().int().positive();

const projectParams = z.object({ projectId: id });
const labelParams = z.object({ projectId: id, labelId: id });

/** `#rrggbb`, normalised to lower case so two spellings can't look like two colours. */
const color = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'color must be a #rrggbb hex value')
  .transform((value) => value.toLowerCase());

const icon = z.enum(LABEL_ICONS);
const name = z.string().trim().min(1).max(40);

const createBody = z.object({ name, color, icon }).strict();
const updateBody = z
  .object({ name: name.optional(), color: color.optional(), icon: icon.optional() })
  .strict()
  .refine(
    (body) => body.name !== undefined || body.color !== undefined || body.icon !== undefined,
    'At least one field is required',
  );

/** Mounted at /projects/:projectId/labels */
export function createLabelRouter(labels: LabelService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get(
    '/',
    handle({ params: projectParams }, async ({ params }, req, res) => {
      res.json(await labels.list(currentUserId(req), params.projectId));
    }),
  );

  router.post(
    '/',
    handle(
      { params: projectParams, body: createBody },
      async ({ params, body }, req, res) => {
        res.status(201).json(await labels.create(currentUserId(req), params.projectId, body));
      },
    ),
  );

  router.patch(
    '/:labelId',
    handle(
      { params: labelParams, body: updateBody },
      async ({ params, body }, req, res) => {
        res.json(await labels.update(currentUserId(req), params.projectId, params.labelId, body));
      },
    ),
  );

  router.delete(
    '/:labelId',
    handle({ params: labelParams }, async ({ params }, req, res) => {
      await labels.remove(currentUserId(req), params.projectId, params.labelId);
      res.status(204).end();
    }),
  );

  return router;
}
