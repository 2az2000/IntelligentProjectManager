import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { projectApi, type ProjectInput } from '../api/project.api';
import type { AssignableRole } from '../types';

const validId = (id: number) => Number.isFinite(id) && id > 0;

export function useProjects() {
  return useQuery({ queryKey: qk.projects.list(), queryFn: projectApi.list });
}

export function useProject(projectId: number) {
  return useQuery({
    queryKey: qk.projects.detail(projectId),
    queryFn: () => projectApi.get(projectId),
    enabled: validId(projectId),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) => projectApi.create(input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.projects.all }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard }),
      ]),
  });
}

export function useUpdateProject(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ProjectInput>) => projectApi.update(projectId, input),
    onSuccess: (project) => {
      queryClient.setQueryData(qk.projects.detail(projectId), project);
      return queryClient.invalidateQueries({ queryKey: qk.projects.all });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: number) => projectApi.remove(projectId),
    onSuccess: (_data, projectId) => {
      queryClient.removeQueries({ queryKey: qk.projects.detail(projectId) });
      queryClient.removeQueries({ queryKey: qk.tasks.byProject(projectId) });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.projects.all }),
        queryClient.invalidateQueries({ queryKey: qk.dashboard }),
        queryClient.invalidateQueries({ queryKey: qk.tasks.all }),
      ]);
    },
  });
}

// ---- members ----------------------------------------------------------------------------

export function useProjectMembers(projectId: number) {
  return useQuery({
    queryKey: qk.projects.members(projectId),
    queryFn: () => projectApi.members(projectId),
    enabled: validId(projectId),
  });
}

function useMemberMutation<TVars>(projectId: number, fn: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.projects.all }),
        queryClient.invalidateQueries({ queryKey: qk.team }),
        queryClient.invalidateQueries({ queryKey: qk.tasks.all }),
      ]),
  });
}

export const useAddMember = (projectId: number) =>
  useMemberMutation(projectId, ({ userId, role, skills }: { userId: number; role: AssignableRole; skills?: string[] }) =>
    projectApi.addMember(projectId, userId, role, skills),
  );
export const useUpdateMember = (projectId: number) =>
  useMemberMutation(projectId, ({ userId, patch }: { userId: number; patch: { role?: AssignableRole; skills?: string[] } }) =>
    projectApi.updateMember(projectId, userId, patch),
  );
export const useRemoveMember = (projectId: number) =>
  useMemberMutation(projectId, (userId: number) => projectApi.removeMember(projectId, userId));

export function useTeam() {
  return useQuery({ queryKey: qk.team, queryFn: projectApi.team });
}
