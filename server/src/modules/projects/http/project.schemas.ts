import { z } from 'zod';
import { PROJECT_ROLES } from '../domain/project-role';

const id = z.coerce.number().int().positive();

export const projectIdParams = z.object({ projectId: id });
export const memberParams = z.object({ projectId: id, userId: id });

const assignableRole = z.enum(PROJECT_ROLES).exclude(['OWNER']);

export const createProjectBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .strict();

export const updateProjectBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable(),
    startDate: z.coerce.date().nullable(),
    endDate: z.coerce.date().nullable(),
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required');

export const addMemberBody = z
  .object({ userId: z.number().int().positive(), role: assignableRole.default('MEMBER') })
  .strict();

export const updateMemberBody = z.object({ role: assignableRole }).strict();
