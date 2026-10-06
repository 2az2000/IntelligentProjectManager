import { z } from 'zod';

const id = z.coerce.number().int().positive();

export const projectIdParams = z.object({ projectId: id });

export const enrichTaskBody = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();
