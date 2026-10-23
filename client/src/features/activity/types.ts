/** Mirrors the activity DTO in server/src/modules/activity/activity.module.ts */
export const ACTIVITY_ACTIONS = ['created', 'updated', 'moved', 'deleted'] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export interface ActivityActor {
  id: number;
  name: string;
  avatarUrl: string | null;
}

/** One cursor page (`GET /tasks/:taskId/activity`); totals cover the whole history. */
export interface ActivityPage {
  items: ActivityEntry[];
  /** Pass back as `cursor` to fetch the next (older) page; null on the last page. */
  nextCursor: number | null;
  total: number;
  people: number;
}

export interface ActivityEntry {
  id: number;
  taskId: number;
  action: ActivityAction;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  actor: ActivityActor;
  createdAt: string;
}
