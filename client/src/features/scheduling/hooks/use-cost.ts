import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import type { CostSummary } from '../components/project-reports';

/** §6 project cost report — tracked hours × rate vs budget. */
export function useCost(projectId: number) {
  return useQuery({
    queryKey: qk.cost.byProject(projectId),
    queryFn: async (): Promise<CostSummary> =>
      (await apiClient.get<CostSummary>(`/projects/${projectId}/cost`)).data,
    enabled: Number.isFinite(projectId) && projectId > 0,
  });
}
