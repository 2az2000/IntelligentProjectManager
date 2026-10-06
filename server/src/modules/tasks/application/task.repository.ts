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
  assignee: UserSummary | null;
  subtaskCount: number;
  doneSubtaskCount: number;
  commentCount: number;
}

export interface TaskDetailView extends TaskView {
  subtasks: TaskView[];
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
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
  status: TaskStatus;
  position: number;
}

export type TaskPatch = Partial<
  Pick<
    TaskProps,
    | 'title'
    | 'description'
    | 'status'
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
  /** Highest position among siblings (same project, parent and — for top level — status). */
  lastPosition(projectId: number, parentId: number | null, status: TaskStatus): Promise<number | undefined>;
  positions(ids: number[]): Promise<PositionInfo[]>;
  /** Renumbers a column evenly, keeping the current order. */
  rebalance(projectId: number, parentId: number | null, status: TaskStatus): Promise<void>;
  /** Unassigns the user from every task of a project (used when a member leaves). */
  unassignUser(projectId: number, userId: number): Promise<void>;
}
