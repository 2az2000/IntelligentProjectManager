import { z } from 'zod';

const email = z.string().trim().min(1, 'required').pipe(z.email('invalidEmail'));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'required'),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'required').max(80, 'tooLong'),
  email,
  password: z.string().min(8, 'passwordTooShort').max(128, 'tooLong'),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
