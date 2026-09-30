import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { dashboardApi } from '../api/dashboard.api';

export function useDashboardSummary() {
  return useQuery({ queryKey: qk.dashboard, queryFn: dashboardApi.summary });
}
