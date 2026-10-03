import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { API, dependencies as dependencyFixtures, tasks as taskFixtures } from '@/test/handlers';
import { server } from '@/test/msw-server';
import {
  useApplySchedule,
  useCreateDependency,
  useDeleteDependency,
  useDependencies,
  useSchedule,
} from './use-schedule';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSchedule / useDependencies', () => {
  it('fetches the CPM schedule for a project', async () => {
    const { result } = renderHook(() => useSchedule(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.projectDurationHours).toBe(24);
    expect(result.current.data?.criticalPath).toEqual([1]);
    expect(result.current.data?.tasks).toHaveLength(2);
  });

  it('lists project dependencies', async () => {
    const { result } = renderHook(() => useDependencies(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(dependencyFixtures);
  });
});

describe('useApplySchedule', () => {
  it('applies the schedule and invalidates task views so mounted views refetch', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    queryClient.setQueryData(['tasks', 'project', 1], taskFixtures);

    const { result } = renderHook(() => useApplySchedule(1), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Board/list observers are invalidated ⇒ they refetch with the new dates.
    expect(queryClient.getQueryState(['tasks', 'project', 1])?.isInvalidated).toBe(true);
  });
});

describe('dependency mutations', () => {
  it('creates a dependency and refreshes the list', async () => {
    const { result } = renderHook(() => useCreateDependency(1), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ predecessorId: 2, successorId: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ predecessorId: 2, successorId: 1 });
  });

  it('surfaces a cycle rejection as an ApiError with the server code', async () => {
    server.use(
      http.post(`${API}/projects/1/dependencies`, () =>
        HttpResponse.json(
          { error: { code: 'DEPENDENCY_CYCLE', message: 'cycle' } },
          { status: 409 },
        ),
      ),
    );
    const { result } = renderHook(() => useCreateDependency(1), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ predecessorId: 2, successorId: 1 });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 'DEPENDENCY_CYCLE', status: 409 });
  });

  it('removes a dependency', async () => {
    const { result } = renderHook(() => useDeleteDependency(1), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ predecessorId: 1, successorId: 2 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useSchedule error shape', () => {
  it('maps 404 to an ApiError with PROJECT_NOT_FOUND', async () => {
    server.use(
      http.get(`${API}/projects/9/schedule`, () =>
        HttpResponse.json({ error: { code: 'PROJECT_NOT_FOUND', message: 'nope' } }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useSchedule(9), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 'PROJECT_NOT_FOUND', status: 404 });
  });
});
