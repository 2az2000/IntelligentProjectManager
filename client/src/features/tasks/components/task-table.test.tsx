import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { projectStatuses, task } from '@/test/handlers';
import type { Task } from '../types';
import { TaskTable } from './task-table';

const messages = (await import('../../../../messages/fa.json')).default;

const makeTask = (id: number, title: string, patch: Partial<Task>): Task =>
  task({ id, title, position: id * 1024, ...patch });

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const renderTable = (tasks: Task[], props: Partial<Parameters<typeof TaskTable>[0]> = {}) =>
  render(<TaskTable tasks={tasks} statuses={projectStatuses} onOpen={() => {}} {...props} />, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="fa" messages={messages}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    ),
  });

describe('TaskTable', () => {
  it('groups by priority with the count and Σ estimate of each group', () => {
    const tasks = [
      makeTask(1, 'Design hero', { priority: 'HIGH', estimateHours: 2 }),
      makeTask(2, 'Write copy', { priority: 'HIGH', estimateHours: 3 }),
      makeTask(3, 'Set up CI', { priority: 'MEDIUM', estimateHours: 8 }),
    ];
    const { container } = renderTable(tasks, { groupBy: 'priority' });

    const high = container.querySelector('[data-group-key="HIGH"]');
    expect(high).toHaveTextContent('زیاد');
    expect(high).toHaveTextContent(/[۲2] تسک/);
    expect(high).toHaveTextContent('Σ ۵ ساعت');

    const medium = container.querySelector('[data-group-key="MEDIUM"]');
    expect(medium).toHaveTextContent(/[۱1] تسک/);
    expect(medium).toHaveTextContent('Σ ۸ ساعت');
  });

  it('edits the title inline on double click', async () => {
    const onPatch = vi.fn();
    renderTable([makeTask(1, 'Design hero', {})], { onPatch });

    await userEvent.dblClick(screen.getByRole('button', { name: 'Design hero' }));
    const input = screen.getByRole('textbox', { name: 'عنوان' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Ship it{Enter}');

    expect(onPatch).toHaveBeenCalledWith(1, { title: 'Ship it' });
  });
});
