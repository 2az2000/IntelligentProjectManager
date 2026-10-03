import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../types';

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'required').max(200, 'tooLong'),
  description: z.string().trim().max(10_000, 'tooLong'),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  assigneeId: z.number().int().positive().nullable(),
  dueDate: z.date().nullable(),
  points: z.number().int().min(0, 'invalidNumber').max(1000, 'invalidNumber').nullable(),
  // Matches the server: Float, 0..10_000 (fractional hours allowed).
  estimateHours: z.number().min(0, 'invalidNumber').max(10_000, 'invalidNumber').nullable(),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

/** "api, backend ,api" → ["api", "backend"] */
export const parseTags = (value: string) => [
  ...new Set(
    value
      .split(/[,،]/)
      .map((tag) => tag.trim())
      .filter(Boolean),
  ),
];
