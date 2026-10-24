/** Audit actions recorded on a task. */
export const ACTIVITY_ACTIONS = ['created', 'updated', 'moved', 'deleted'] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** One screenful of audit rows; "load more" fetches the next page with `cursor`. */
export const ACTIVITY_PAGE_SIZE = 8;
export const ACTIVITY_MAX_PAGE_SIZE = 50;

export interface ActivityActor {
  id: number;
  name: string;
  avatarUrl: string | null;
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

/**
 * One cursor page of `GET /tasks/:taskId/activity`. `total` and `people` cover the whole
 * history, not just the loaded rows.
 */
export interface ActivityPage {
  items: ActivityEntry[];
  /** Pass back as `cursor` to fetch the next (older) page; null on the last page. */
  nextCursor: number | null;
  total: number;
  people: number;
}
