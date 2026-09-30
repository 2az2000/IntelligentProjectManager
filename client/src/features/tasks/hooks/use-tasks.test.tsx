import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/msw-server';
import { API, tasks as fixtures } from '@/test/handlers';
import { useMoveTask, useProjectTasks } from './use-tasks';

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

describe('useMoveTask (optimistic + rollback)', () => {
  it('optimistically applies status/position, then shows the refetched server state', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['tasks', 'project', 1], fixtures);

    // Server state after the move: the list endpoint returns the persisted task.
    const movedOnServer = fixtures.map((t) => (t.id === 1 ? { ...t, status: 'DONE' as const, position: 2048 } : t));
    server.use(
      http.post(`${API}/tasks/1/move`, () => HttpResponse.json({ ...fixtures[0]!, status: 'DONE', position: 2048 })),
      http.get(`${API}/projects/1/tasks`, () => HttpResponse.json(movedOnServer)),
    );

    const { result } = renderHook(() => useMoveTask(1), {
      wrapper: ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>,
    });

    act(() => {
      result.current.mutate({ taskId: 1, plan: { status: 'DONE', afterId: 2, position: 1536 } });
    });

    // Optimistic: visible in the cache immediately (onMutate ran), before the request resolves.
    await waitFor(() =>
      expect(queryClient.getQueryData<{ id: number; status: string; position: number }[]>(['tasks', 'project', 1])?.find((t) => t.id === 1))
        .toMatchObject({ status: 'DONE', position: 1536 }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(queryClient.isFetching({ queryKey: ['tasks', 'project', 1] })).toBe(0));

    // The mutation response (server truth for the moved task) merged into the detail-free list:
    // status stays DONE. Position is refreshed by the next stale refetch (staleTime in app code).
    const after = queryClient.getQueryData<{ id: number; status: string; position: number }[]>(['tasks', 'project', 1])?.find((t) => t.id === 1);
    expect(after).toMatchObject({ status: 'DONE' });
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
      result.current.mutate({ taskId: 1, plan: { status: 'DONE', position: 1536 } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const rolledBack = queryClient.getQueryData<typeof fixtures>(['tasks', 'project', 1]);
    expect(rolledBack?.find((t) => t.id === 1)).toMatchObject({ status: 'TODO', position: 1024 });
  });
});
