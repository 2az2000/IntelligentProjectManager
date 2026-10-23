import { z } from 'zod';

const id = z.coerce.number().int().positive();

export const projectIdParams = z.object({ projectId: id });

export const enrichTaskBody = z
  .object({
    title: z.string().trim().min(3).max(200),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

export const breakdownBody = z
  .object({
    prd: z.string().trim().min(20, 'Paste a little more of the brief').max(8000),
  })
  .strict();

/** Chat history is bounded by turns *and* total characters (a free model has a finite window). */
export const chatBody = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          content: z.string().trim().min(1).max(4000),
        }),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    (value) => value.messages.reduce((sum, m) => sum + m.content.length, 0) <= 16_000,
    { message: 'Conversation is too long — start a new chat', path: ['messages'] },
  )
  .refine((value) => value.messages.at(-1)?.role === 'user', {
    message: 'The last message must come from the user',
    path: ['messages'],
  });

export type ChatBody = z.infer<typeof chatBody>;
