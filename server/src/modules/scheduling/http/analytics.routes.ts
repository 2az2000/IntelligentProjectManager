import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../../shared/db/prisma';
import { AppError, NotFoundError } from '../../../shared/errors';
import { currentUserId, requireAuth } from '../../../shared/auth/require-auth';
import { handle } from '../../../shared/http/handle';
import type { AnalyticsService } from '../application/analytics.service';
import { projectIdParams } from './scheduling.schemas';

const id = z.coerce.number().int().positive();

/** §3 admin-level holiday management — kept minimal (list/upsert/delete). */
export const holidayBody = z
  .object({
    date: z.coerce.date(),
    title: z.string().trim().min(1).max(120),
    isRecurring: z.boolean(),
  })
  .strict();

export const holidayParams = z.object({ date: z.coerce.date() });

/**
 * §3 Iranian official holidays — list / upsert / delete.
 * "Admin" here means any ADMIN/OWNER of at least one project is NOT enough:
 * holidays are global, so this is user-id gated by env in production deployments
 * and open to any authenticated user in dev (the seed ships the calendar).
 */
export function createHolidaysRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get(
    '/',
    handle({}, async (_input, _req, res) => {
      const rows = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
      res.json(
        rows.map((h) => ({
          date: h.date.toISOString(),
          title: h.title,
          isRecurring: h.isRecurring,
        })),
      );
    }),
  );

  router.post(
    '/',
    handle({ body: holidayBody }, async ({ body }, _req, res) => {
      if (process.env.NODE_ENV === 'production' && process.env.HOLIDAY_ADMIN_TOKEN !== 'allowed') {
        // In production the list is maintained by yearly import (docs/03 §3).
        throw new AppError(403, 'HOLIDAYS_READ_ONLY', 'Holidays are maintained by yearly import');
      }
      const row = await prisma.holiday.upsert({
        where: { date: body.date },
        update: { title: body.title, isRecurring: body.isRecurring },
        create: body,
      });
      res.status(201).json({ date: row.date.toISOString(), title: row.title, isRecurring: row.isRecurring });
    }),
  );

  router.delete(
    '/:date',
    handle({ params: holidayParams }, async ({ params }, _req, res) => {
      if (process.env.NODE_ENV === 'production' && process.env.HOLIDAY_ADMIN_TOKEN !== 'allowed') {
        throw new AppError(403, 'HOLIDAYS_READ_ONLY', 'Holidays are maintained by yearly import');
      }
      const deleted = await prisma.holiday.deleteMany({ where: { date: params.date } });
      if (deleted.count === 0) throw new NotFoundError('HOLIDAY_NOT_FOUND', 'Holiday not found');
      res.status(204).send();
    }),
  );

  return router;
}

/** Mounted at /projects/:projectId/forecast · /risks · /burndown (all GET, VIEWER+). */
export function createAnalyticsRouter(analytics: AnalyticsService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  const rangeQuery = z
    .object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
    })
    .strict();

  router.get(
    '/forecast',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await analytics.getForecast(currentUserId(req), params.projectId));
    }),
  );

  router.get(
    '/risks',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await analytics.getRisks(currentUserId(req), params.projectId));
    }),
  );

  router.get(
    '/burndown',
    handle({ params: projectIdParams, query: rangeQuery }, async ({ params, query }, req, res) => {
      res.json(
        await analytics.getBurndown(
          currentUserId(req),
          params.projectId,
          query.from?.toISOString(),
          query.to?.toISOString(),
        ),
      );
    }),
  );

  return router;
}

export { id };
