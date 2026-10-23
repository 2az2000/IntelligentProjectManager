import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { NextIntlClientProvider } from 'next-intl';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { API, admin, sara } from '@/test/handlers';
import { server } from '@/test/msw-server';
import type { ActivityEntry } from '../types';
import { ActivityTimeline } from './activity-timeline';

const messages = (await import('../../../../messages/fa.json')).default;

/** Ten field edits, newest first; the first page must stop at eight. */
const entries: ActivityEntry[] = Array.from({ length: 10 }, (_, index) => ({
  id: 100 - index,
  taskId: 1,
  action: 'updated',
  field: 'points',
  oldValue: String(index),
  newValue: String(index + 1),
  actor: index % 2 === 0 ? admin : sara,
  createdAt: `2026-09-30T10:${String(30 - index).padStart(2, '0')}:00.000Z`,
}));

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <NextIntlClientProvider locale="fa" messages={messages}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  };
}

describe('ActivityTimeline', () => {
  it('shows one page of eight rows and reveals the rest on demand', async () => {
    const urls: string[] = [];
    server.use(
      http.get(`${API}/tasks/1/activity`, ({ request }) => {
        urls.push(request.url);
        const cursor = new URL(request.url).searchParams.get('cursor');
        return HttpResponse.json({
          items: cursor ? entries.slice(8) : entries.slice(0, 8),
          nextCursor: cursor ? null : entries[7].id,
          total: entries.length,
          people: 2,
        });
      }),
    );
    const user = userEvent.setup();

    render(<ActivityTimeline taskId={1} />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(8));
    // The header counts the whole history, not just the loaded page.
    const summary = screen.getByText((_, element) => element?.tagName === 'SPAN' && /نفر/.test(element.textContent ?? ''));
    expect(summary.textContent).toMatch(/۱۰|10/);

    await user.click(screen.getByRole('button', { name: 'نمایش موارد بیشتر' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(10));
    expect(screen.queryByRole('button', { name: 'نمایش موارد بیشتر' })).toBeNull();
    expect(urls[0]).toContain('limit=8');
    expect(urls[0]).not.toContain('cursor=');
    expect(urls[1]).toContain(`cursor=${entries[7].id}`);
  });

  it('hides the button when the first page is the whole history', async () => {
    render(<ActivityTimeline taskId={1} />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'نمایش موارد بیشتر' })).toBeNull();
  });
});
