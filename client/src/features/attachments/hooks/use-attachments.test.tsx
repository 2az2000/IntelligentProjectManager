import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { API, attachments as fixture } from '@/test/handlers';
import { server } from '@/test/msw-server';
import { useAttachments, useDeleteAttachment, useUploadAttachment } from './use-attachments';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAttachments', () => {
  it('lists a task\u2019s attachments with uploader and size', async () => {
    const { result } = renderHook(() => useAttachments(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({
      fileName: 'hero-brief.pdf',
      size: 2048,
      uploader: { id: 2 },
    });
  });

  it('stays disabled for invalid task ids', () => {
    const { result } = renderHook(() => useAttachments(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('attachment mutations', () => {
  it('uploads a file and refreshes the list', async () => {
    const { result } = renderHook(() => useUploadAttachment(1), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate(new File(['hello phase 5'], 'uploaded.txt', { type: 'text/plain' }));
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ fileName: 'uploaded.txt', size: 13 });
  });

  it('deletes an attachment', async () => {
    const { result } = renderHook(() => useDeleteAttachment(1), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate(fixture[0].id);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('maps an outsider upload to 404 so the project stays hidden', async () => {
    server.use(
      http.post(`${API}/tasks/9/attachments`, () =>
        HttpResponse.json({ error: { code: 'TASK_NOT_FOUND', message: 'nope' } }, { status: 404 }),
      ),
    );
    const { result } = renderHook(() => useUploadAttachment(9), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate(new File(['x'], 'x.txt', { type: 'text/plain' }));
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 'TASK_NOT_FOUND', status: 404 });
  });
});
