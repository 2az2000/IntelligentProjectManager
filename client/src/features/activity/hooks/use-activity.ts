import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { activityApi } from '../api/activity.api';

const validId = (id: number | null | undefined): id is number =>
  typeof id === 'number' && Number.isFinite(id) && id > 0;

export function useActivity(taskId: number | null) {
  return useQuery({
    queryKey: qk.activity.byTask(taskId ?? 0),
    queryFn: () => activityApi.list(taskId!),
    enabled: validId(taskId),
  });
}
