import { z } from 'zod';
import { PROJECT_ROLES } from '../domain/project-role';

const id = z.coerce.number().int().positive();

export const projectIdParams = z.object({ projectId: id });
export const memberParams = z.object({ projectId: id, userId: id });

const assignableRole = z.enum(PROJECT_ROLES).exclude(['OWNER']);

/** Free-text specialties shown to the AI when it suggests assignees. */
const skills = z.array(z.string().trim().min(1).max(40)).max(10);

export const createProjectBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullish(),
    startDate: z.coerce.date().nullish(),
    endDate: z.coerce.date().nullish(),
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
  .object({
    userId: z.number().int().positive(),
    role: assignableRole.default('MEMBER'),
    skills: skills.optional(),
  })
  .strict();

export const updateMemberBody = z
  .object({ role: assignableRole.optional(), skills: skills.optional() })
  .strict()
  .refine((body) => body.role !== undefined || body.skills !== undefined, 'At least one field is required');
