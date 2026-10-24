import type { z } from 'zod';
import type { UserSummary } from './task';
import type { ZodInstance } from './task';

/** Project membership roles, ordered VIEWER < MEMBER < ADMIN < OWNER. */
export const PROJECT_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/** Everyone except the owner can be handed out through the members endpoints. */
export const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const RANK: Record<ProjectRole, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

/** VIEWER < MEMBER < ADMIN < OWNER */
export const hasRole = (actual: ProjectRole, required: ProjectRole): boolean =>
  RANK[actual] >= RANK[required];

export const projectRoleSchema = (z: ZodInstance) => z.enum(PROJECT_ROLES);
export const assignableRoleSchema = (z: ZodInstance) => z.enum(ASSIGNABLE_ROLES);

/** `POST /projects` */
export const createProjectPayloadSchema = (z: ZodInstance) =>
  z
    .object({
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(2000).nullish(),
      startDate: z.coerce.date().nullish(),
      endDate: z.coerce.date().nullish(),
    })
    .strict();
export type CreateProjectPayload = z.infer<ReturnType<typeof createProjectPayloadSchema>>;

/** `PATCH /projects/:projectId` — every field optional, at least one required. */
export const updateProjectPayloadSchema = (z: ZodInstance) =>
  z
    .object({
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(2000).nullable(),
      startDate: z.coerce.date().nullable(),
      endDate: z.coerce.date().nullable(),
      /** §6: default billing rate for members without an override. */
      hourlyRate: z.number().min(0).max(1_000_000).nullable().optional(),
      /** §6: total approved budget — drives the budget bar in the cost report. */
      budgetAmount: z.number().min(0).max(1_000_000_000).nullable().optional(),
      /** §4 WIP limits per workflow column, e.g. {"IN_PROGRESS": 5}; null clears them. */
      columnLimits: z
        .record(z.string().max(40), z.number().int().min(0).max(200))
        .nullable()
        .optional(),
    })
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'At least one field is required');
export type UpdateProjectPayload = z.infer<ReturnType<typeof updateProjectPayloadSchema>>;

/** `POST /projects/:projectId/members` */
export const addMemberPayloadSchema = (z: ZodInstance) =>
  z
    .object({
      userId: z.number().int().positive(),
      role: assignableRoleSchema(z).default('MEMBER'),
      /** Free-text specialties shown to the AI when it suggests assignees. */
      skills: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
    })
    .strict();
export type AddMemberPayload = z.infer<ReturnType<typeof addMemberPayloadSchema>>;

/** `PATCH /projects/:projectId/members/:userId` */
export const updateMemberPayloadSchema = (z: ZodInstance) =>
  z
    .object({
      role: assignableRoleSchema(z).optional(),
      skills: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
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
export type UpdateMemberPayload = z.infer<ReturnType<typeof updateMemberPayloadSchema>>;

/** §11: createProjectPayloadSchema + the chosen template id. */
export const fromTemplatePayloadSchema = (z: ZodInstance) =>
  z
    .object({
      templateId: z.string().trim().min(1).max(60),
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(2000).nullish(),
      startDate: z.coerce.date().nullish(),
      endDate: z.coerce.date().nullish(),
    })
    .strict();
export type FromTemplatePayload = z.infer<ReturnType<typeof fromTemplatePayloadSchema>>;

/** A date on the wire: the client may pass a `Date` (axios serializes it) or an ISO string. */
type DateInput = Date | string;

/** `POST /projects` as the client sends it. */
export interface CreateProjectRequest extends Omit<CreateProjectPayload, 'startDate' | 'endDate'> {
  startDate?: DateInput | null;
  endDate?: DateInput | null;
}

/** `PATCH /projects/:projectId` as the client sends it. */
export interface UpdateProjectRequest extends Omit<UpdateProjectPayload, 'startDate' | 'endDate'> {
  startDate?: DateInput | null;
  endDate?: DateInput | null;
}

export interface ProjectStats {
  total: number;
  done: number;
  overdue: number;
  /** §3 per-parent subtask progress (done/total) for parent cards. */
  subtaskProgress: { taskId: number; done: number; total: number }[];
}

/** Mirrors `ProjectDto` in docs/02-API-CONTRACT.md. */
export interface ProjectDto {
  id: number;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  ownerId: number;
  owner: UserSummary;
  myRole: ProjectRole;
  memberCount: number;
  /** §4 WIP limits per board column (null = unlimited). */
  columnLimits: Record<string, number> | null;
  stats: ProjectStats;
  createdAt: string;
  updatedAt: string;
}
