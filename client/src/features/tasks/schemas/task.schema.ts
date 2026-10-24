import {
  MAX_ESTIMATE_HOURS,
  MAX_POINTS,
  MAX_STATUS_KEY,
  MAX_TASK_DESCRIPTION,
  MAX_TASK_TITLE,
  TASK_PRIORITIES,
} from '@managesys/contracts';
import { z } from 'zod';

/**
 * The client half of the task contract: limits and enums come from `@managesys/contracts` while
 * the messages stay i18n keys (`required`, `tooLong`…) that the dialog translates.
 */
export const taskFormSchema = z.object({
  title: z.string().trim().min(1, 'required').max(MAX_TASK_TITLE, 'tooLong'),
  description: z.string().trim().max(MAX_TASK_DESCRIPTION, 'tooLong'),
  /** A column key of the project the task is created in (validated by the server). */
  statusKey: z.string().trim().min(1, 'required').max(MAX_STATUS_KEY),
  priority: z.enum(TASK_PRIORITIES),
  /** Ordered assignee set: index 0 is the lead. Empty = nobody on the task. */
  assigneeIds: z.array(z.number().int().positive()),
  dueDate: z.date().nullable(),
  points: z.number().int().min(0, 'invalidNumber').max(MAX_POINTS, 'invalidNumber').nullable(),
  // Matches the server: Float, 0..MAX_ESTIMATE_HOURS (fractional hours allowed).
  estimateHours: z
    .number()
    .min(0, 'invalidNumber')
    .max(MAX_ESTIMATE_HOURS, 'invalidNumber')
    .nullable(),
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
