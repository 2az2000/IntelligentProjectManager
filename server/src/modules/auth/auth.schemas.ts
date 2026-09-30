import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254));

export const registerBody = z
  .object({
    email,
    password: z.string().min(8).max(128),
    name: z.string().trim().min(1).max(80),
  })
  .strict();

export const changePasswordBody = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
  })
  .strict();

export const loginBody = z
  .object({
    email,
    password: z.string().min(1).max(128),
  })
  .strict();
