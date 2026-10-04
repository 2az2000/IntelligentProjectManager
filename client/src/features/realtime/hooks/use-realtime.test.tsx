import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRealtimeSocket } from '../socket';
import { useProjectPresence, useProjectSocket } from './use-realtime';

type Handler = (payload: unknown) => void;

/** Minimal socket double: records handlers and lets tests emit at them. */
function makeFakeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  return {
    emitted: [] as Array<[string, unknown]>,
    disconnect: vi.fn(),
    on: vi.fn((event: string, handler: Handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn((event: string, handler: Handler) => handlers.get(event)?.delete(handler)),
    emit: vi.fn((event: string, payload?: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).emitted.push([event, payload]);
    }),
    __emitToClient: (event: string, payload: unknown) => {
      handlers.get(event)?.forEach((handler) => handler(payload));
    },
  };
}
type FakeSocket = ReturnType<typeof makeFakeSocket>;

let socket: FakeSocket;

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => socket),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  socket = makeFakeSocket();
  resetRealtimeSocket();
});

describe('useProjectSocket', () => {
  it('joins the project room and invalidates task views on task:changed', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['tasks', 'project', 1], [{ id: 1 }]);

    renderHook(() => useProjectSocket(1), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    expect(socket.emitted).toEqual([['project:join', 1]]);

    act(() => {
      socket.__emitToClient('task:changed', { projectId: 1, taskId: 1, kind: 'updated', actorId: 2 });
    });

    await waitFor(() =>
      expect(queryClient.getQueryState(['tasks', 'project', 1])?.isInvalidated).toBe(true),
    );
  });

  it('ignores events from other projects and detaches handlers on unmount', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['tasks', 'project', 1], [{ id: 1 }]);

    const { unmount } = renderHook(() => useProjectSocket(1), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      socket.__emitToClient('task:changed', { projectId: 99, taskId: 5, kind: 'updated', actorId: 2 });
    });
    expect(queryClient.getQueryState(['tasks', 'project', 1])?.isInvalidated).toBe(false);

    const onCount = socket.on.mock.calls.length;
    unmount();
    expect(socket.off).toHaveBeenCalledTimes(onCount);
  });

  it('refreshes the open task\u2019s comments on comment:created', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['comments', 1], []);

    renderHook(() => useProjectSocket(1), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    act(() => {
      socket.__emitToClient('comment:created', {
        projectId: 1,
        taskId: 1,
        commentId: 7,
        authorId: 2,
        mentionedUserIds: [],
      });
    });

    await waitFor(() => expect(queryClient.getQueryState(['comments', 1])?.isInvalidated).toBe(true));
  });
});

describe('useProjectPresence', () => {
  it('tracks the online user ids for the joined room', () => {
    const { result } = renderHook(() => useProjectPresence(1), { wrapper: createWrapper() });
    expect(result.current).toEqual([]);

    act(() => {
      socket.__emitToClient('presence:update', { projectId: 1, userIds: [2, 1] });
    });
    expect(result.current).toEqual([1, 2]);

    act(() => {
      socket.__emitToClient('presence:update', { projectId: 2, userIds: [9] });
    });
    expect(result.current).toEqual([1, 2]); // other rooms do not leak in
  });
});
