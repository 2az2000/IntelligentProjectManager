import { z } from 'zod';
import { MAX_TAGS, TASK_PRIORITIES, TASK_STATUSES } from '../domain/task.entity';

const id = z.coerce.number().int().positive();

export const taskIdParams = z.object({ taskId: id });
export const projectIdParams = z.object({ projectId: id });

const nullableDate = z.coerce.date().nullable();
const tags = z.array(z.string().trim().min(1).max(30)).max(MAX_TAGS);

export const createTaskBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10_000).optional(),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    points: z.number().int().min(0).max(1000).optional(),
    startDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    estimateHours: z.number().min(0).max(10_000).optional(),
    assigneeId: z.number().int().positive().optional(),
    parentId: z.number().int().positive().optional(),
    tags: tags.optional(),
  })
  .strict();

export const updateTaskBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(10_000).nullable(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    points: z.number().int().min(0).max(1000).nullable(),
    startDate: nullableDate,
    dueDate: nullableDate,
    estimateHours: z.number().min(0).max(10_000).nullable(),
    assigneeId: z.number().int().positive().nullable(),
    tags,
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');

export const moveTaskBody = z
  .object({
    status: z.enum(TASK_STATUSES),
    beforeId: z.number().int().positive().optional(),
    afterId: z.number().int().positive().optional(),
  })
  .strict();

export const listTasksQuery = z.object({
  status: z.enum(TASK_STATUSES).optional(),
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
