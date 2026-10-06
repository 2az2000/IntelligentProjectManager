import { apiClient } from '@/lib/api-client';
import type { Comment, Task, TaskDetail, TaskPriority, TaskStatus } from '../types';

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  points?: number;
  estimateHours?: number;
  assigneeId?: number;
  dueDate?: string;
  parentId?: number;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  points?: number | null;
  estimateHours?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeId?: number | null;
  tags?: string[];
}

export interface MoveTaskInput {
  status: TaskStatus;
  beforeId?: number;
  afterId?: number;
}

export const taskApi = {
  listByProject: async (projectId: number): Promise<Task[]> =>
    (await apiClient.get<Task[]>(`/projects/${projectId}/tasks`)).data,
  get: async (taskId: number): Promise<TaskDetail> =>
    (await apiClient.get<TaskDetail>(`/tasks/${taskId}`)).data,
  create: async (projectId: number, input: CreateTaskInput): Promise<Task> =>
    (await apiClient.post<Task>(`/projects/${projectId}/tasks`, input)).data,
  update: async (taskId: number, input: UpdateTaskInput): Promise<Task> =>
    (await apiClient.patch<Task>(`/tasks/${taskId}`, input)).data,
  move: async (taskId: number, input: MoveTaskInput): Promise<Task> =>
    (await apiClient.post<Task>(`/tasks/${taskId}/move`, input)).data,
  remove: async (taskId: number): Promise<void> => {
    await apiClient.delete(`/tasks/${taskId}`);
  },
  mine: async (includeDone: boolean): Promise<Task[]> =>
    (await apiClient.get<Task[]>('/me/tasks', { params: { includeDone } })).data,
  /** §11 recycling bin */
  trash: async (projectId: number): Promise<Task[]> =>
    (await apiClient.get<Task[]>(`/projects/${projectId}/tasks/trash`)).data,
  restore: async (projectId: number, taskId: number): Promise<Task> =>
    (await apiClient.post<Task>(`/projects/${projectId}/tasks/trash/${taskId}/restore`, {})).data,
  calendar: async (from: string, to: string, scope: 'mine' | 'all'): Promise<Task[]> =>
    (await apiClient.get<Task[]>('/me/calendar', { params: { from, to, scope } })).data,
};

export const commentApi = {
  list: async (taskId: number): Promise<Comment[]> =>
    (await apiClient.get<Comment[]>(`/tasks/${taskId}/comments`)).data,
  create: async (taskId: number, body: string): Promise<Comment> =>
    (await apiClient.post<Comment>(`/tasks/${taskId}/comments`, { body })).data,
  update: async (commentId: number, body: string): Promise<Comment> =>
    (await apiClient.patch<Comment>(`/comments/${commentId}`, { body })).data,
  remove: async (commentId: number): Promise<void> => {
    await apiClient.delete(`/comments/${commentId}`);
  },
};
