import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { API, notifications as fixture } from '@/test/handlers';
import { server } from '@/test/msw-server';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from './use-notifications';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useNotifications / useUnreadCount', () => {
  it('lists notifications newest-first with actor and task', async () => {
    const { result } = renderHook(() => useNotifications(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0]).toMatchObject({ type: 'ASSIGNED', actor: { id: 2 } });
    expect(result.current.data?.[0].task?.projectName).toBe('Website Redesign');
  });

  it('counts only unread notifications', async () => {
    const { result } = renderHook(() => useUnreadCount(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data).toBe(1)); // fixture: 1 unread of 2
  });

  it('marks one notification as read', async () => {
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate(fixture[0].id);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('maps a foreign notification id to 404 NOTIFICATION_NOT_FOUND', async () => {
    server.use(
      http.post(`${API}/notifications/99/read`, () =>
        HttpResponse.json({ error: { code: 'NOTIFICATION_NOT_FOUND', message: 'nope' } }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useMarkNotificationRead(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate(99);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 'NOTIFICATION_NOT_FOUND', status: 404 });
  });

  it('marks everything as read', async () => {
    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
