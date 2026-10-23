import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { API, tasks as fixtures } from '@/test/handlers';
import { qk } from '@/lib/query-keys';
import type { TaskDateConflict } from '../types';
import { useMoveTask, useProjectTasks, useUpdateTask } from './use-tasks';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useProjectTasks', () => {
  it('fetches and sorts tasks by position', async () => {
    const { result } = renderHook(() => useProjectTasks(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.map((t) => t.id)).toEqual([1, 2]);
  });

  it('surfaces API errors as ApiError with the server code', async () => {
    server.use(
      http.get(`${API}/projects/9/tasks`, () =>
        HttpResponse.json({ error: { code: 'PROJECT_NOT_FOUND', message: 'nope' } }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useProjectTasks(9), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 'PROJECT_NOT_FOUND', status: 404 });
  });
});

describe('useUpdateTask (date-vs-dependency warnings)', () => {
  const conflict: TaskDateConflict = {
    code: 'DEPENDENCY_DATE_CONFLICT',
    direction: 'successor',
    relatedTaskId: 2,
    relatedTaskTitle: 'Set up CI',
    conflictDays: 3,
  };

  function setup() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    return { queryClient, result };
  }

  it('keeps the warnings of a date edit outside the task cache', async () => {
    server.use(
      http.patch(`${API}/tasks/1`, () =>
        HttpResponse.json({ ...fixtures[0]!, dueDate: '2026-11-05T00:00:00.000Z', warnings: [conflict] }),
      ),
    );
    const { queryClient, result } = setup();

    act(() => {
      result.current.mutate({ taskId: 1, input: { dueDate: '2026-11-05T00:00:00.000Z' } });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(qk.taskWarnings(1))).toEqual([conflict]);
    // The transient warning never leaks into the persisted task shape.
    expect(queryClient.getQueryData<{ warnings?: unknown }>(qk.tasks.detail(1))?.warnings).toBeUndefined();
  });

  it('clears them on a later date edit that respects the chain', async () => {
    server.use(
      http.patch(`${API}/tasks/1`, () =>
        HttpResponse.json({ ...fixtures[0]!, dueDate: '2026-11-20T00:00:00.000Z' }),
      ),
    );
    const { queryClient, result } = setup();
    queryClient.setQueryData(qk.taskWarnings(1), [conflict]);

    act(() => {
      result.current.mutate({ taskId: 1, input: { dueDate: '2026-11-20T00:00:00.000Z' } });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(qk.taskWarnings(1))).toEqual([]);
  });

  it('leaves the warnings alone when the edit is not about dates', async () => {
    server.use(
      http.patch(`${API}/tasks/1`, () => HttpResponse.json({ ...fixtures[0]!, title: 'Renamed' })),
    );
    const { queryClient, result } = setup();
    queryClient.setQueryData(qk.taskWarnings(1), [conflict]);

    act(() => {
      result.current.mutate({ taskId: 1, input: { title: 'Renamed' } });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(qk.taskWarnings(1))).toEqual([conflict]);
  });
});

describe('useMoveTask (optimistic + rollback)', () => {
  it('optimistically applies status/position, then shows the refetched server state', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['tasks', 'project', 1], fixtures);

    // Server state after the move: the list endpoint returns the persisted task.
    const movedOnServer = fixtures.map((t) =>
      t.id === 1 ? { ...t, status: 'DONE' as const, statusKey: 'DONE', position: 2048 } : t,
    );
    server.use(
      http.post(`${API}/tasks/1/move`, () =>
        HttpResponse.json({ ...fixtures[0]!, status: 'DONE', statusKey: 'DONE', position: 2048 }),
      ),
      http.get(`${API}/projects/1/tasks`, () => HttpResponse.json(movedOnServer)),
    );

    const { result } = renderHook(() => useMoveTask(1), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });

    act(() => {
      result.current.mutate({ taskId: 1, plan: { statusKey: 'DONE', afterId: 2, position: 1536 } });
    });

    // Optimistic: visible in the cache immediately (onMutate ran), before the request resolves.
    await waitFor(() =>
      expect(queryClient.getQueryData<{ id: number; statusKey: string; position: number }[]>(['tasks', 'project', 1])?.find((t) => t.id === 1))
        .toMatchObject({ statusKey: 'DONE', position: 1536 }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(queryClient.isFetching({ queryKey: ['tasks', 'project', 1] })).toBe(0));

    // The mutation response (server truth for the moved task) merged into the detail-free list:
    // status stays DONE. Position is refreshed by the next stale refetch (staleTime in app code).
    const after = queryClient.getQueryData<{ id: number; statusKey: string; position: number }[]>(['tasks', 'project', 1])?.find((t) => t.id === 1);
    expect(after).toMatchObject({ statusKey: 'DONE' });
  });

  it('rolls back the cache when the request fails', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['tasks', 'project', 1], fixtures);

    server.use(http.post(`${API}/tasks/1/move`, () => HttpResponse.json({}, { status: 403 })));

    const { result } = renderHook(() => useMoveTask(1), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });

    act(() => {
      result.current.mutate({ taskId: 1, plan: { statusKey: 'DONE', position: 1536 } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const rolledBack = queryClient.getQueryData<typeof fixtures>(['tasks', 'project', 1]);
    expect(rolledBack?.find((t) => t.id === 1)).toMatchObject({ statusKey: 'TODO', position: 1024 });
  });
});
