import type { z } from 'zod';

/**
 * Task payloads and DTO shapes — the shared half of `docs/02-API-CONTRACT.md`.
 *
 * Payload schemas are *factories*: the server and the client each pass their own `zod` instance.
 * A package-owned copy of zod would be a second class identity — `instanceof ZodError` in the
 * server's error handler and `extendZodWithOpenApi` would silently stop working — so the contract
 * owns the shape, not the runtime.
 */

/** The caller's zod instance (`typeof import('zod').z`). */
export type ZodInstance = typeof z;

/**
 * The *analytics buckets* of a task. The board columns a task actually sits in are the project's
 * own `statusKey`s (`ProjectStatus.key`) — every column maps to exactly one of these.
 */
export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Field limits, shared so the editor, the form and the API reject the same inputs. */
export const MAX_TASK_TITLE = 200;
export const MAX_TASK_DESCRIPTION = 10_000;
export const MAX_DESCRIPTION_HTML = 20_000;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const MAX_STATUS_KEY = 40;
export const MAX_POINTS = 1000;
export const MAX_ESTIMATE_HOURS = 10_000;
export const MAX_TASK_ASSIGNEES = 50;

export interface UserSummary {
  id: number;
  name: string;
  avatarUrl: string | null;
}

/**
 * A manual date that contradicts a dependency (`PATCH /tasks/:id` only).
 *
 * Advisory: the write lands, the user sees why the plan looks impossible.
 */
export interface TaskDateConflict {
  code: 'DEPENDENCY_DATE_CONFLICT';
  /** `predecessor`: this task starts before an upstream task finishes.
   *  `successor`: this task ends after a downstream task starts. */
  direction: 'predecessor' | 'successor';
  relatedTaskId: number;
  relatedTaskTitle: string;
  /** Whole days of overlap; always ≥ 1. */
  conflictDays: number;
}

export const taskTitleSchema = (z: ZodInstance) =>
  z.string().trim().min(1).max(MAX_TASK_TITLE);

export const taskTagsSchema = (z: ZodInstance) =>
  z.array(z.string().trim().min(1).max(MAX_TAG_LENGTH)).max(MAX_TAGS);

/** A workflow column of the task's project (`ProjectStatus.key`). */
export const taskStatusKeySchema = (z: ZodInstance) =>
  z.string().trim().min(1).max(MAX_STATUS_KEY);

/** `POST /projects/:projectId/tasks` */
export const createTaskPayloadSchema = (z: ZodInstance) => {
  const points = z.number().int().min(0).max(MAX_POINTS);
  const estimateHours = z.number().min(0).max(MAX_ESTIMATE_HOURS);
  /** The whole assignee set: the first id leads, the rest are co-assignees (validated as members). */
  const assigneeIds = z.array(z.number().int().positive()).max(MAX_TASK_ASSIGNEES);

  return z
    .object({
      title: taskTitleSchema(z),
      description: z.string().trim().max(MAX_TASK_DESCRIPTION).optional(),
      /** §4 rich text body; the server sanitizes it and derives `description` from it. */
      descriptionHtml: z.string().trim().max(MAX_DESCRIPTION_HTML).optional(),
      // `statusKey` is the workflow column; `status` stays accepted as the legacy category spelling.
      statusKey: taskStatusKeySchema(z).optional(),
      status: z.enum(TASK_STATUSES).optional(),
      priority: z.enum(TASK_PRIORITIES).optional(),
      points: points.optional(),
      startDate: z.coerce.date().optional(),
      dueDate: z.coerce.date().optional(),
      estimateHours: estimateHours.optional(),
      assigneeId: z.number().int().positive().optional(),
      assigneeIds: assigneeIds.optional(),
      parentId: z.number().int().positive().optional(),
      tags: taskTagsSchema(z).optional(),
    })
    .strict();
};
export type CreateTaskPayload = z.infer<ReturnType<typeof createTaskPayloadSchema>>;

/** `PATCH /tasks/:taskId` — every field optional, at least one required. */
export const updateTaskPayloadSchema = (z: ZodInstance) => {
  const nullableDate = z.coerce.date().nullable();

  return z
    .object({
      title: taskTitleSchema(z),
      description: z.string().trim().max(MAX_TASK_DESCRIPTION).nullable(),
      descriptionHtml: z.string().trim().max(MAX_DESCRIPTION_HTML).nullable(),
      statusKey: taskStatusKeySchema(z),
      status: z.enum(TASK_STATUSES),
      priority: z.enum(TASK_PRIORITIES),
      points: z.number().int().min(0).max(MAX_POINTS).nullable(),
      startDate: nullableDate,
      dueDate: nullableDate,
      estimateHours: z.number().min(0).max(MAX_ESTIMATE_HOURS).nullable(),
      assigneeId: z.number().int().positive().nullable(),
      assigneeIds: z.array(z.number().int().positive()).max(MAX_TASK_ASSIGNEES),
      tags: taskTagsSchema(z),
    })
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, 'At least one field is required');
};
export type UpdateTaskPayload = z.infer<ReturnType<typeof updateTaskPayloadSchema>>;


/** `PATCH /tasks/:taskId/move` — a column key (or the legacy category) and the drop neighbours. */
export const moveTaskPayloadSchema = (z: ZodInstance) =>
  z
    .object({
      statusKey: taskStatusKeySchema(z).optional(),
      status: z.enum(TASK_STATUSES).optional(),
      beforeId: z.number().int().positive().optional(),
      afterId: z.number().int().positive().optional(),
    })
    .strict()
    .refine(
      (body) => body.statusKey !== undefined || body.status !== undefined,
      'statusKey is required',
    );
export type MoveTaskPayload = z.infer<ReturnType<typeof moveTaskPayloadSchema>>;

/** A date on the wire: the client may pass a `Date` (axios serializes it) or an ISO string. */
type DateInput = Date | string;

/** `POST /projects/:projectId/tasks` as the client sends it. */
export interface CreateTaskRequest extends Omit<CreateTaskPayload, 'startDate' | 'dueDate'> {
  startDate?: DateInput;
  dueDate?: DateInput;
}

/** `PATCH /tasks/:taskId` as the client sends it. */
export interface UpdateTaskRequest extends Omit<UpdateTaskPayload, 'startDate' | 'dueDate'> {
  startDate?: DateInput | null;
  dueDate?: DateInput | null;
}

/** `POST /tasks/:taskId/move`. */
export type MoveTaskRequest = MoveTaskPayload;

/** `GET /projects/:projectId/tasks` filters (query strings arrive as strings, so ids coerce). */
export const taskFiltersSchema = (z: ZodInstance) =>
  z.object({
    status: z.enum(TASK_STATUSES).optional(),
    statusKey: taskStatusKeySchema(z).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().min(1).max(100).optional(),
    parentId: z.coerce.number().int().positive().optional(),
  });
export type TaskListFilters = z.infer<ReturnType<typeof taskFiltersSchema>>;

/** Everything `GET /tasks/:id` returns, minus the nested subtasks. */
export interface TaskDto {
  id: number;
  projectId: number;
  project: { id: number; name: string };
  parentId: number | null;
  title: string;
  description: string | null;
  /** §4 sanitized rich text body; `description` is its plain-text twin. */
  descriptionHtml: string | null;
  status: TaskStatus;
  /** The project's workflow column this task sits in (`ProjectStatus.key`). */
  statusKey: string;
  priority: TaskPriority;
  position: number;
  tags: string[];
  points: number | null;
  startDate: string | null;
  dueDate: string | null;
  /** Effort estimate in working hours; null = not estimated (drives CPM scheduling). */
  estimateHours: number | null;
  completedAt: string | null;
  author: UserSummary;
  /** Lead assignee (`assigneeId`); null when nobody owns the task. */
  assignee: UserSummary | null;
  /** Lead first, then co-assignees — everyone who shares the task. */
  assignees: UserSummary[];
  subtaskCount: number;
  doneSubtaskCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  /** Only on a PATCH response: date edits that clash with the dependency chain. */
  warnings?: TaskDateConflict[];
}

export interface TaskDetailDto extends TaskDto {
  subtasks: TaskDto[];
}
