import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { activityEntries as fixture } from '@/test/handlers';
import { useActivity } from './use-activity';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useActivity', () => {
  it('lists the task audit trail with field diffs', async () => {
    const { result } = renderHook(() => useActivity(1), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(fixture);
    expect(result.current.data?.[0]).toMatchObject({
      action: 'updated',
      field: 'status',
      oldValue: 'TODO',
      newValue: 'IN_PROGRESS',
      actor: { id: 2 },
    });
  });

  it('stays idle without a task id', () => {
    const { result } = renderHook(() => useActivity(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
