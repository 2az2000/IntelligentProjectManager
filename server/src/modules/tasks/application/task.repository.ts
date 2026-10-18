import type {
  Task,
  TaskPriority,
  TaskProps,
  TaskStatus,
  ValidNewTask,
} from '../domain/task.entity';

export interface UserSummary {
  id: number;
  name: string;
  avatarUrl: string | null;
}

/** Read model returned by queries: task data plus the relations the UI needs. */
export interface TaskView extends TaskProps {
  project: { id: number; name: string };
  author: UserSummary;
  /** The lead assignee (`assigneeId`), or null when the task has no owner. */
  assignee: UserSummary | null;
  /** Lead first, then co-assignees in insertion order. Equal to `assignee` when there is one. */
  assignees: UserSummary[];
  subtaskCount: number;
  doneSubtaskCount: number;
  commentCount: number;
}

export interface TaskDetailView extends TaskView {
  subtasks: TaskView[];
}

export interface TaskFilters {
  /** Analytics bucket filter (kept for the category-level filters in the UI). */
  status?: TaskStatus;
  /** Workflow-column filter — an exact `ProjectStatus.key`. */
  statusKey?: string;
  priority?: TaskPriority;
  /** Matches tasks where the user is the lead **or** a co-assignee. */
  assigneeId?: number;
  search?: string;
  /** Subtasks of this task; when omitted only top-level tasks are returned. */
  parentId?: number;
}

export interface AssignedTaskFilters {
  includeDone?: boolean;
  dueFrom?: Date;
  dueTo?: Date;
  /** When set, tasks of these projects regardless of assignee (calendar "all" scope). */
  anyAssignee?: boolean;
}

export interface PositionInfo {
  id: number;
  projectId: number;
  parentId: number | null;
  statusKey: string;
  position: number;
}

export type TaskPatch = Partial<
  Pick<
    TaskProps,
    | 'title'
    | 'description'
    | 'status'
    | 'statusKey'
    | 'priority'
    | 'tags'
    | 'points'
    | 'startDate'
    | 'dueDate'
    | 'estimateHours'
    | 'assigneeId'
    | 'completedAt'
    | 'position'
  >
>;

export interface TaskRepository {
  create(data: ValidNewTask): Promise<TaskView>;
  findById(id: number): Promise<Task | null>;
  /** Like findById but also sees soft-deleted rows (recycling-bin restore). */
  findByIdAny(id: number): Promise<Task | null>;
  getDetail(id: number): Promise<TaskDetailView | null>;
  list(projectId: number, filters: TaskFilters): Promise<TaskView[]>;
  listForUser(userId: number, projectIds: number[], filters: AssignedTaskFilters): Promise<TaskView[]>;
  update(id: number, patch: TaskPatch): Promise<TaskView>;
  /** Soft-deletes the task and its subtasks. */
  softDelete(id: number, now: Date): Promise<void>;
  /** §11 recycling bin: deleted top-level tasks with their subtask counts. */
  listDeleted(projectId: number): Promise<TaskView[]>;
  /** Restores the task (and any subtasks deleted in the same action). */
  restore(id: number): Promise<TaskView | null>;
  /**
   * Ordered assignee set: the lead first, then co-assignees (empty when the task is unowned).
   * Used to diff/merge edits and to decide who gets notified.
   */
  assigneeSet(taskId: number): Promise<number[]>;
  /**
   * Replaces the whole assignee set: `userIds[0]` becomes the lead, the rest co-assignees.
   * An empty list leaves the task with no owner at all.
   */
  setAssignees(taskId: number, userIds: number[]): Promise<TaskView>;
  /** Highest position among siblings (same project, parent and — for top level — column). */
  lastPosition(
    projectId: number,
    parentId: number | null,
    statusKey: string,
  ): Promise<number | undefined>;
  positions(ids: number[]): Promise<PositionInfo[]>;
  /** Renumbers a column evenly, keeping the current order. */
  rebalance(projectId: number, parentId: number | null, statusKey: string): Promise<void>;
  /**
   * Detaches the user from every task of a project (used when a member leaves): drops their
   * co-assignee rows and hands any task they led to the first remaining co-assignee, or to
   * nobody when they were alone on it.
   */
  unassignUser(projectId: number, userId: number): Promise<void>;
}
