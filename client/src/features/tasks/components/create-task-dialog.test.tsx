import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { API, sara, task } from '@/test/handlers';
import { server } from '@/test/msw-server';
import { CreateTaskDialog } from './create-task-dialog';

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

describe('CreateTaskDialog AI enrichment', () => {
  it('fills the form from the AI preview and creates the task with selected subtasks', async () => {
    const user = userEvent.setup();
    const created: { title?: string; parentId?: number | null }[] = [];
    let nextId = 100;
    server.use(
      http.post(`${API}/projects/1/tasks`, async ({ request }) => {
        const body = (await request.json()) as { title: string; parentId?: number | null };
        const id = nextId++;
        created.push({ title: body.title, parentId: body.parentId ?? null });
        return HttpResponse.json(task({ id, title: body.title, parentId: body.parentId ?? null }), { status: 201 });
      }),
    );

    render(
      <CreateTaskDialog projectId={1} members={[sara]} />,
      { wrapper: createWrapper() },
    );

    // Open the dialog and type a rough title.
    await user.click(screen.getByRole('button', { name: 'تسک جدید' }));
    await user.type(screen.getByPlaceholderText('چه کاری باید انجام شود؟'), 'صفحه فرود کمپین');

    // Ask the AI for a preview (mocked by the MSW handlers).
    await user.click(screen.getByRole('button', { name: 'تکمیل با هوش مصنوعی' }));

    await waitFor(() =>
      expect(screen.getByLabelText('توضیحات')).toHaveValue('AI-written description for the rough task.'),
    );
    expect(screen.getByText('Draft the outline')).toBeInTheDocument();
    expect(screen.getByText('Implement the design')).toBeInTheDocument();
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toBeChecked();

    // Submit (the trigger is aria-hidden while the dialog is open, so this is the submit button):
    // the parent task is created first, then the selected subtasks under it.
    await user.click(screen.getByRole('button', { name: 'تسک جدید' }));

    await waitFor(() => expect(created).toHaveLength(4));
    expect(created[0]?.title).toBe('صفحه فرود کمپین');
    expect(created[0]?.parentId).toBeNull();
    expect(created.slice(1).map((c) => c.parentId)).toEqual([100, 100, 100]);
  });
});
