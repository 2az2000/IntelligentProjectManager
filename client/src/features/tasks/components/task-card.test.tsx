import { DndContext } from '@dnd-kit/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { NextIntlClientProvider } from 'next-intl';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw-server';
import { API, task as makeTask } from '@/test/handlers';
import type { TaskDetail } from '../types';
import { SortableTaskCard, TaskCardView } from './task-card';

const messages = (await import('../../../../messages/fa.json')).default;

const parent = makeTask({ id: 1, title: 'Design hero section', subtaskCount: 3, doneSubtaskCount: 1 });

const detail: TaskDetail = {
  ...parent,
  subtasks: [
    makeTask({ id: 11, parentId: 1, title: 'Draft the outline', status: 'DONE' }),
    makeTask({ id: 12, parentId: 1, title: 'Implement the design', status: 'IN_PROGRESS' }),
    makeTask({ id: 13, parentId: 1, title: 'Review and polish', status: 'TODO' }),
  ],
};

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

describe('TaskCardView — subtask peek', () => {
  it('lists the subtasks without leaving the board', async () => {
    server.use(http.get(`${API}/tasks/1`, () => HttpResponse.json(detail)));
    const user = userEvent.setup();

    render(<TaskCardView task={parent} onOpen={() => {}} onOpenTask={() => {}} />, {
      wrapper: createWrapper(),
    });

    // Counts come from the list payload, so they render before any detail request.
    const trigger = screen.getByRole('button', { name: 'نمایش زیرتسک‌ها' });
    expect(trigger).toHaveTextContent('۱/۳');

    await user.click(trigger);
    expect(await screen.findByText('Draft the outline')).toBeInTheDocument();
    expect(screen.getByText('Implement the design')).toBeInTheDocument();
    expect(screen.getByText('Review and polish')).toBeInTheDocument();
  });

  it('keeps Enter on the badge from also opening the parent card', async () => {
    server.use(http.get(`${API}/tasks/1`, () => HttpResponse.json(detail)));
    const user = userEvent.setup();
    const onOpen = vi.fn();

    // The real board wraps the card in a sortable node whose Enter handler opens the task;
    // the badge's own Enter must not bubble into it.
    render(
      <DndContext>
        <SortableTaskCard task={parent} onOpen={onOpen} />
      </DndContext>,
      { wrapper: createWrapper() },
    );

    const trigger = screen.getByRole('button', { name: 'نمایش زیرتسک‌ها' });
    trigger.focus();
    await user.keyboard('{Enter}');

    expect(await screen.findByText('Draft the outline')).toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('opens a subtask and never opens the parent card', async () => {
    server.use(http.get(`${API}/tasks/1`, () => HttpResponse.json(detail)));
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onOpenTask = vi.fn();

    render(<TaskCardView task={parent} onOpen={onOpen} onOpenTask={onOpenTask} />, {
      wrapper: createWrapper(),
    });

    const trigger = screen.getByRole('button', { name: 'نمایش زیرتسک‌ها' });
    await user.click(trigger);
    expect(onOpen).not.toHaveBeenCalled();

    await user.click(await screen.findByText('Implement the design'));
    expect(onOpenTask).toHaveBeenCalledWith(12);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
