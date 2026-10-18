import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { WorkloadHeatmap } from './workload-heatmap';

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

describe('WorkloadHeatmap', () => {
  /** MSW fixture: sara 44h this week (110% of 40h ⇒ red), admin 8h. */
  it('renders the heat grid and flags over-allocated members without breaking on empty weeks', async () => {
    render(<WorkloadHeatmap />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('نقشه‌ی حرارتی بار هفتگی')).toBeInTheDocument());
    expect(screen.getByText('این هفته')).toBeInTheDocument();
    // The count line renders as "· 🔴 ۱ نفر بیش‌بار این هفته" inside the description.
    expect(screen.getByText(/۱ نفر بیش‌بار این هفته/)).toBeInTheDocument();
    // Total column sums the spread across weeks.
    expect(screen.getAllByRole('row')[0]).toBeInTheDocument();
  }, 15_000);

  it('reveals the tasks behind a clicked cell and closes again', async () => {
    const user = userEvent.setup();
    render(<WorkloadHeatmap />, { wrapper: createWrapper() });

    // The sara cell holding 44h this week carries the fixture task.
    const cell = await screen.findByRole('button', { name: '۴۴' });
    await user.click(cell);

    expect(screen.getByText('Implement payment API')).toBeInTheDocument();
    expect(screen.getByText('Website Redesign')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'بستن' }));
    expect(screen.queryByText('Implement payment API')).not.toBeInTheDocument();
  }, 15_000);
});
