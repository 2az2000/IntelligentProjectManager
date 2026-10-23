import { useInfiniteQuery } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { activityApi } from '../api/activity.api';

const validId = (id: number | null | undefined): id is number =>
  typeof id === 'number' && Number.isFinite(id) && id > 0;

/**
 * The stored activity is long (one row per changed field), so it loads a page at a time:
 * `data.pages` holds everything fetched so far, `fetchNextPage` appends older rows.
 */
export function useActivity(taskId: number | null) {
  return useInfiniteQuery({
    queryKey: qk.activity.byTask(taskId ?? 0),
    queryFn: ({ pageParam }) => activityApi.list(taskId!, pageParam),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: validId(taskId),
  });
}
