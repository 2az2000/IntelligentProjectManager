import { z } from 'zod';

// Error messages are translation keys in the `Validation` namespace.
export const projectFormSchema = z
  .object({
    name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
    description: z.string().trim().max(2000, 'tooLong'),
    startDate: z.date().nullable(),
    endDate: z.date().nullable(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: 'endBeforeStart',
    path: ['endDate'],
  });

export type ProjectFormValues = z.infer<typeof projectFormSchema>;
