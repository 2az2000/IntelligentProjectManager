import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useErrorMessage } from '@/hooks/use-error-message';
import { qk } from '@/lib/query-keys';

export interface TimeEntry {
  id: number;
  taskId: number;
  userId: number;
  startedAt: string;
  endedAt: string | null;
  minutes: number;
  manual: boolean;
}

export interface OpenTimer extends TimeEntry {
  taskTitle: string;
}

export const timeApi = {
  openTimer: async (): Promise<OpenTimer | null> =>
    (await apiClient.get<OpenTimer | null>('/me/timer')).data,
  start: async (taskId: number): Promise<TimeEntry> =>
    (await apiClient.post<TimeEntry>(`/tasks/${taskId}/time/start`)).data,
  stop: async (taskId: number): Promise<TimeEntry | null> =>
    (await apiClient.post<TimeEntry | null>(`/tasks/${taskId}/time/stop`)).data,
  manual: async (taskId: number, input: { startedAt: string; minutes: number }): Promise<TimeEntry> =>
    (await apiClient.post<TimeEntry>(`/tasks/${taskId}/time/manual`, input)).data,
  forTask: async (taskId: number): Promise<TimeEntry[]> =>
    (await apiClient.get<TimeEntry[]>(`/tasks/${taskId}/time`)).data,
};

/** The user's single open stopwatch (drives the TaskSheet timer button). */
export function useOpenTimer() {
  return useQuery({ queryKey: qk.time.openTimer, queryFn: timeApi.openTimer });
}

function useInvalidateTime() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.time.all }),
      queryClient.invalidateQueries({ queryKey: qk.cost.all }),
    ]);
}

export function useStartTimer() {
  const invalidate = useInvalidateTime();
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: timeApi.start,
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useStopTimer() {
  const invalidate = useInvalidateTime();
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: timeApi.stop,
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useManualTime() {
  const invalidate = useInvalidateTime();
  const toMessage = useErrorMessage();
  return useMutation({
    mutationFn: (input: { taskId: number; startedAt: string; minutes: number }) =>
      timeApi.manual(input.taskId, { startedAt: input.startedAt, minutes: input.minutes }),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useTaskTime(taskId: number | null) {
  return useQuery({
    queryKey: qk.time.byTask(taskId ?? 0),
    queryFn: () => timeApi.forTask(taskId!),
    enabled: Number.isFinite(taskId) && taskId !== null && taskId > 0,
  });
}
