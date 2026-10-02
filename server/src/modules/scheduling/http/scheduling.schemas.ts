import { z } from 'zod';

const id = z.coerce.number().int().positive();

export const projectIdParams = z.object({ projectId: id });
export const scheduleTaskParams = z.object({ taskId: id });

export const dependencyBody = z
  .object({
    predecessorId: z.number().int().positive(),
    successorId: z.number().int().positive(),
  })
  .strict()
  .refine((b) => b.predecessorId !== b.successorId, 'A task cannot depend on itself');

export const dependencyPathParams = z.object({
  predecessorId: id,
  successorId: id,
});
