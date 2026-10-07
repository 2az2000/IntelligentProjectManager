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
    /** §6: default billing rate for members without an override. */
    hourlyRate: z.number().min(0).max(1_000_000).nullable().optional(),
    /** §6: total approved budget — drives the budget bar in the cost report. */
    budgetAmount: z.number().min(0).max(1_000_000_000).nullable().optional(),
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
  .object({
    role: assignableRole.optional(),
    skills: skills.optional(),
    /** §3: weekly capacity in working hours (null = back to server default). */
    capacityHoursPerWeek: z.number().int().min(1).max(80).nullable().optional(),
    /** §6: personal hourly rate override (null = back to project default). */
    hourlyRate: z.number().min(0).max(1_000_000).nullable().optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.role !== undefined ||
      body.skills !== undefined ||
      body.capacityHoursPerWeek !== undefined ||
      body.hourlyRate !== undefined,
    'At least one field is required',
  );

/** §11: createProjectBody + the chosen template id. */
export const fromTemplateBody = z
  .object({
    templateId: z.string().trim().min(1).max(60),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullish(),
    startDate: z.coerce.date().nullish(),
    endDate: z.coerce.date().nullish(),
  })
  .strict();
