import { z } from 'zod';
import { MAX_DESCRIPTION_HTML } from '../domain/rich-text';
import { MAX_TAGS, TASK_PRIORITIES, TASK_STATUSES } from '../domain/task.entity';

const id = z.coerce.number().int().positive();

export const taskIdParams = z.object({ taskId: id });

/** §11 recycling bin: POST /projects/:projectId/tasks/trash/:taskId/restore */
export const trashRestoreParams = z.object({ projectId: id, taskId: id });
export const projectIdParams = z.object({ projectId: id });

const nullableDate = z.coerce.date().nullable();
const tags = z.array(z.string().trim().min(1).max(30)).max(MAX_TAGS);
/** A workflow column of the task's project (`ProjectStatus.key`). */
const statusKey = z.string().trim().min(1).max(40);
/** The whole assignee set: the first id leads, the rest are co-assignees (validated as members). */
const assigneeIds = z.array(z.number().int().positive()).max(50);

export const createTaskBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10_000).optional(),
    /** §4 rich text body; the server sanitizes it and derives `description` from it. */
    descriptionHtml: z.string().trim().max(MAX_DESCRIPTION_HTML).optional(),
    // `statusKey` is the workflow column; `status` stays accepted as the legacy category spelling.
    statusKey: statusKey.optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    points: z.number().int().min(0).max(1000).optional(),
    startDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    estimateHours: z.number().min(0).max(10_000).optional(),
    assigneeId: z.number().int().positive().optional(),
    assigneeIds: assigneeIds.optional(),
    parentId: z.number().int().positive().optional(),
    tags: tags.optional(),
  })
  .strict();

export const updateTaskBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10_000).nullable(),
    descriptionHtml: z.string().trim().max(MAX_DESCRIPTION_HTML).nullable(),
    statusKey: statusKey,
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    points: z.number().int().min(0).max(1000).nullable(),
    startDate: nullableDate,
    dueDate: nullableDate,
    estimateHours: z.number().min(0).max(10_000).nullable(),
    assigneeId: z.number().int().positive().nullable(),
    assigneeIds,
    tags,
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');

export const moveTaskBody = z
  .object({
    statusKey: statusKey.optional(),
    status: z.enum(TASK_STATUSES).optional(),
    beforeId: z.number().int().positive().optional(),
    afterId: z.number().int().positive().optional(),
  })
  .strict()
  .refine(
    (body) => body.statusKey !== undefined || body.status !== undefined,
    'statusKey is required',
  );
// Built-in keys are spelled like their category, so a legacy `status` body still resolves.
const toMoveInput = (body: z.infer<typeof moveTaskBody>) => ({
  statusKey: body.statusKey ?? body.status!,
  ...(body.beforeId !== undefined && { beforeId: body.beforeId }),
  ...(body.afterId !== undefined && { afterId: body.afterId }),
});
export type MoveTaskBody = ReturnType<typeof toMoveInput>;
export { toMoveInput };

export const listTasksQuery = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  statusKey: statusKey.optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: id.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  parentId: id.optional(),
});

const booleanFlag = z.enum(['true', 'false']).transform((v) => v === 'true');

export const myTasksQuery = z.object({
  includeDone: booleanFlag.optional(),
});

export const calendarQuery = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    scope: z.enum(['mine', 'all']).default('mine'),
  })
  .refine((q) => q.from <= q.to, 'from must be before to')
  .refine((q) => q.to.getTime() - q.from.getTime() <= 62 * 24 * 60 * 60 * 1000, 'Range too large');
