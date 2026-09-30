import { apiClient } from '@/lib/api-client';
import type { AssignableRole, Project, ProjectMember, Teammate } from '../types';

export interface ProjectInput {
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export const projectApi = {
  list: async (): Promise<Project[]> => (await apiClient.get<Project[]>('/projects')).data,
  get: async (projectId: number): Promise<Project> =>
    (await apiClient.get<Project>(`/projects/${projectId}`)).data,
  create: async (input: ProjectInput): Promise<Project> =>
    (await apiClient.post<Project>('/projects', input)).data,
  update: async (projectId: number, input: Partial<ProjectInput>): Promise<Project> =>
    (await apiClient.patch<Project>(`/projects/${projectId}`, input)).data,
  remove: async (projectId: number): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}`);
  },

  members: async (projectId: number): Promise<ProjectMember[]> =>
    (await apiClient.get<ProjectMember[]>(`/projects/${projectId}/members`)).data,
  addMember: async (projectId: number, userId: number, role: AssignableRole): Promise<ProjectMember> =>
    (await apiClient.post<ProjectMember>(`/projects/${projectId}/members`, { userId, role })).data,
  updateMember: async (projectId: number, userId: number, role: AssignableRole): Promise<ProjectMember> =>
    (await apiClient.patch<ProjectMember>(`/projects/${projectId}/members/${userId}`, { role })).data,
  removeMember: async (projectId: number, userId: number): Promise<void> => {
    await apiClient.delete(`/projects/${projectId}/members/${userId}`);
  },

  team: async (): Promise<Teammate[]> => (await apiClient.get<Teammate[]>('/me/team')).data,
};
