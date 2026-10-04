import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { NotificationBell } from './notification-bell';

// The bell opens tasks through the ?task=<id> sheet; the real i18n navigation
// module needs Next's runtime, which jsdom-only vitest does not provide.
vi.mock('@/i18n/navigation', () => ({
  Link: (props: object) => <a {...props} />,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => '/',
}));

// Keep the jsdom test out of socket.io land (no server here to connect to).
vi.mock('@/features/realtime', () => ({
  getRealtimeSocket: () => null,
}));

const messages = (await import('../../../../messages/fa.json')).default;

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <NextIntlClientProvider locale="fa" messages={messages}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </NextIntlClientProvider>
    );
  };
}

describe('NotificationBell', () => {
  it('shows the unread badge and the notification list with translated type lines', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByTestId('unread-badge')).toHaveTextContent('1'));

    await user.click(screen.getByRole('button', { name: 'اعلان‌ها' }));

    const list = await screen.findByRole('list', { name: 'اعلان‌ها' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    // ASSIGNED line from the fixture: Sara assigned the admin a task.
    expect(within(list).getByText(/تسک «Design hero section» را به شما سپرد/)).toBeInTheDocument();
    // MENTIONED line.
    expect(within(list).getByText(/از شما نام برد/)).toBeInTheDocument();
  });

  it('offers "mark all read" and disables it once nothing is unread', async () => {
    const user = userEvent.setup();
    render(<NotificationBell />, { wrapper: createWrapper() });

    await user.click(screen.getByRole('button', { name: 'اعلان‌ها' }));
    const markAll = await screen.findByRole('button', { name: 'خواندن همه' });
    expect(markAll).toBeEnabled();
    await waitFor(() => expect(screen.getByTestId('unread-badge')).toHaveTextContent('1'));
  });
});
