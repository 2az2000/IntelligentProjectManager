import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { dashboardApi } from '../api/dashboard.api';

export function useDashboardSummary() {
  return useQuery({ queryKey: qk.dashboard, queryFn: dashboardApi.summary });
}

/** The report behind the daily-digest notification — fetched only while its modal is open. */
export function useDigest(enabled: boolean) {
  return useQuery({
    queryKey: qk.digest,
    queryFn: dashboardApi.digest,
    enabled,
    staleTime: 60_000,
  });
}
