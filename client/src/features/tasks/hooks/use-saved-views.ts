import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  savedViewsApi,
  type SavedView,
  type SavedViewFilters,
} from '../api/saved-views.api';

/** §4 saved views — the caller's own named filter sets for one project. */
export function useSavedViews(projectId: number) {
  return useQuery({
    queryKey: qk.savedViews(projectId),
    queryFn: () => savedViewsApi.list(projectId),
    enabled: Number.isFinite(projectId) && projectId > 0,
  });
}

export function useSaveView(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; filters: SavedViewFilters }) =>
      savedViewsApi.create(projectId, input),
    onSuccess: (view) =>
      queryClient.setQueryData<SavedView[]>(qk.savedViews(projectId), (views = []) => [
        ...views,
        view,
      ]),
  });
}

export function useUpdateView(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ viewId, filters }: { viewId: number; filters: SavedViewFilters }) =>
      savedViewsApi.update(projectId, viewId, { filters }),
    onSuccess: (view) =>
      queryClient.setQueryData<SavedView[]>(qk.savedViews(projectId), (views = []) =>
        views.map((candidate) => (candidate.id === view.id ? view : candidate)),
      ),
  });
}

export function useDeleteView(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (viewId: number) => savedViewsApi.remove(projectId, viewId),
    onSuccess: (_data, viewId) =>
      queryClient.setQueryData<SavedView[]>(qk.savedViews(projectId), (views = []) =>
        views.filter((view) => view.id !== viewId),
      ),
  });
}
