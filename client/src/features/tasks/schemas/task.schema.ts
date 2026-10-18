import { z } from 'zod';
import { TASK_PRIORITIES } from '../types';

export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'required').max(200, 'tooLong'),
  description: z.string().trim().max(10_000, 'tooLong'),
  /** A column key of the project the task is created in (validated by the server). */
  statusKey: z.string().trim().min(1, 'required').max(40),
  priority: z.enum(TASK_PRIORITIES),
  /** Ordered assignee set: index 0 is the lead. Empty = nobody on the task. */
  assigneeIds: z.array(z.number().int().positive()),
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
