import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { project, tasks as fixtures } from '@/test/handlers';
import { KanbanBoard } from './kanban-board';
import { applyFilters } from './board-filters';

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

describe('KanbanBoard', () => {
  it('renders the four columns with translated titles', () => {
    render(
      <KanbanBoard projectId={project.id} tasks={fixtures} allTasks={fixtures} readOnly onOpen={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole('region', { name: 'انجام نشده' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'در حال انجام' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'بازبینی' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'انجام شده' })).toBeInTheDocument();
  });

  it('places tasks in their status column with translated priority badge', () => {
    render(
      <KanbanBoard projectId={project.id} tasks={fixtures} allTasks={fixtures} readOnly onOpen={() => {}} />,
      { wrapper: createWrapper() },
    );

    const todo = screen.getByRole('region', { name: 'انجام نشده' });
    expect(within(todo).getByText('Design hero section')).toBeInTheDocument();

    const done = screen.getByRole('region', { name: 'انجام شده' });
    expect(within(done).getByText('Set up CI')).toBeInTheDocument();

    expect(screen.getAllByText('زیاد')).toHaveLength(1);
  });

  it('filters by search text', () => {
    const visible = applyFilters(fixtures, { search: 'hero' });
    expect(visible.map((t) => t.title)).toEqual(['Design hero section']);

    const byTag = applyFilters(fixtures, { search: 'design' });
    expect(byTag.map((t) => t.title)).toEqual(['Design hero section']);

    const none = applyFilters(fixtures, { search: 'nothing-matches' });
    expect(none).toHaveLength(0);
  });
});

describe('ErrorState', () => {
  it('shows a translated message for a known error code with retry', async () => {
    const { ErrorState } = await import('@/components/shared/error-state');
    const { ApiError } = await import('@/lib/api-client');
    const error = new ApiError(0, 'NETWORK_ERROR', 'Network Error');
    render(<ErrorState error={error} onRetry={() => {}} />, { wrapper: createWrapper() });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('ارتباط با سرور برقرار نشد. مطمئن شوید backend در حال اجراست.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تلاش دوباره' })).toBeInTheDocument();
  });
});
