import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth } from '../../../shared/auth/require-auth';
import { handle } from '../../../shared/http/handle';
import type { BulkService } from '../application/bulk.service';
import { projectIdParams } from './task.schemas';

export const bulkUpdateBody = z
  .object({
    ids: z.array(z.number().int().positive()).min(1).max(100),
    patch: z
      .object({
        status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        assigneeId: z.number().int().positive().nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (b) => Object.values(b.patch).some((v) => v !== undefined),
    'patch must contain at least one field',
  );

/** Mounted at /projects/:projectId/tasks (extra routes) */
export function createBulkRouter(bulk: BulkService): Router {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.post(
    '/bulk',
    handle({ params: projectIdParams, body: bulkUpdateBody }, async ({ params, body }, req, res) => {
      const result = await bulk.bulkUpdate(currentUserId(req), params.projectId, body);
      res.json(result);
    }),
  );

  // §34 unassigned tasks — the ownership handover report.
  router.get(
    '/unassigned',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      res.json(await bulk.listUnassigned(currentUserId(req), params.projectId));
    }),
  );

  // §27 export: CSV (Excel opens it natively; kept dependency-free on purpose).
  router.get(
    '/export.csv',
    handle({ params: projectIdParams }, async ({ params }, req, res) => {
      const tasks = await bulk.listExportRows(currentUserId(req), params.projectId);
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const header = ['id', 'title', 'status', 'priority', 'assignee', 'estimate_hours', 'start', 'due', 'tags'];
      const rows = tasks.map((t) =>
        [
          t.id,
          t.title,
          t.status,
          t.priority,
          t.assignee ?? '',
          t.estimateHours ?? '',
          t.startDate?.toISOString() ?? '',
          t.dueDate?.toISOString() ?? '',
          t.tags.join('|'),
        ]
          .map(esc)
          .join(','),
      );
      // BOM so Excel detects UTF-8 Persian correctly.
      res.setHeader('content-type', 'text/csv; charset=utf-8');
      res.setHeader('content-disposition', `attachment; filename="project-${params.projectId}-tasks.csv"`);
      res.send(`\uFEFF${[header.join(','), ...rows].join('\r\n')}`);
    }),
  );

  return router;
}
