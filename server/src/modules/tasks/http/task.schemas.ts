import {
  createTaskPayloadSchema,
  moveTaskPayloadSchema,
  taskFiltersSchema,
  updateTaskPayloadSchema,
} from '@managesys/contracts';
import { z } from 'zod';

const id = z.coerce.number().int().positive();

export const taskIdParams = z.object({ taskId: id });

/** §11 recycling bin: POST /projects/:projectId/tasks/trash/:taskId/restore */
export const trashRestoreParams = z.object({ projectId: id, taskId: id });
export const projectIdParams = z.object({ projectId: id });

// Payload shapes live in @managesys/contracts — the client's dialogs are typed from the same
// definitions, so a field rename breaks `tsc` on both sides instead of 400-ing in production.
export const createTaskBody = createTaskPayloadSchema(z);
export const updateTaskBody = updateTaskPayloadSchema(z);
export const listTasksQuery = taskFiltersSchema(z);

export const moveTaskBody = moveTaskPayloadSchema(z);
// Built-in keys are spelled like their category, so a legacy `status` body still resolves.
const toMoveInput = (body: z.infer<typeof moveTaskBody>) => ({
  statusKey: body.statusKey ?? body.status!,
  ...(body.beforeId !== undefined && { beforeId: body.beforeId }),
  ...(body.afterId !== undefined && { afterId: body.afterId }),
});
export type MoveTaskBody = ReturnType<typeof toMoveInput>;
export { toMoveInput };

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
