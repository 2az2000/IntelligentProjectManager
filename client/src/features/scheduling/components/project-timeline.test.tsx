import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import { API, project, schedule as fixture } from '@/test/handlers';
import { server } from '@/test/msw-server';
import { ProjectTimeline } from './project-timeline';

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

describe('ProjectTimeline', () => {
  it('shows the project duration and the only critical task', async () => {
    render(<ProjectTimeline projectId={project.id} />, { wrapper: createWrapper() });

    // Seed-shaped fixture: 24 h total, task 1 alone on the critical path.
    await waitFor(() => expect(screen.getByText('Design hero section')).toBeInTheDocument());
    expect(screen.getByText('مجموعاً ۲۴ ساعت')).toBeInTheDocument();
    expect(screen.getByText('۱ تسک در مسیر بحرانی')).toBeInTheDocument();
  });

  it('marks the critical bar, dims the DONE bar and never mixes them up', async () => {
    render(<ProjectTimeline projectId={project.id} />, { wrapper: createWrapper() });

    const critical = await screen.findByRole('img', { name: /Design hero section/ });
    expect(critical.className).toContain('bg-primary');
    // Critical = solid primary, DONE = muted, so the classes must differ.
    const done = screen.getByRole('img', { name: /Set up CI/ });
    expect(done.className).not.toContain('bg-primary');

    // The DONE task with an estimate is not on the critical path fixture (criticalPath: [1]).
    expect(fixture.criticalPath).toEqual([1]);
  });

  it('renders a dependency line for the finish-to-start edge', async () => {
    render(<ProjectTimeline projectId={project.id} />, { wrapper: createWrapper() });

    await screen.findByRole('img', { name: /Design hero section/ });
    // One SVG overlay with one path for the single dependency (1 -> 2).
    const overlay = document.querySelector('svg[viewBox^="0 0 100"]');
    expect(overlay).not.toBeNull();
    expect(overlay?.querySelectorAll('path')).toHaveLength(1);
  });

  it('warns about unestimated tasks and hides the apply button for viewers', async () => {
    server.use(
      http.get(`${API}/projects/1/schedule`, () =>
        HttpResponse.json({
          ...fixture,
          tasks: [...fixture.tasks, {
            id: 3, title: 'Unplanned', status: 'TODO', estimateHours: null, startDate: null,
            dueDate: null, earliestStart: 24, earliestFinish: 24, latestStart: 24, latestFinish: 24,
            slack: 0, isCritical: false, scheduledStart: null, scheduledFinish: null,
          }],
          unestimatedTaskIds: [3],
        }),
      ),
      http.get(`${API}/projects/1`, () => HttpResponse.json({ ...project, myRole: 'VIEWER' })),
    );

    render(<ProjectTimeline projectId={project.id} />, { wrapper: createWrapper() });

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('۱ تسک تخمین ساعت ندارند'),
    );
    expect(screen.queryByRole('button', { name: 'پر کردن تاریخ‌های خالی' })).not.toBeInTheDocument();
  });

  it('shows an empty state when the project has no tasks', async () => {
    server.use(
      http.get(`${API}/projects/1/schedule`, () =>
        HttpResponse.json({ ...fixture, tasks: [], unestimatedTaskIds: [] }),
      ),
    );
    render(<ProjectTimeline projectId={project.id} />, { wrapper: createWrapper() });

    expect(await screen.findByText('هنوز تسکی برای زمان‌بندی نیست')).toBeInTheDocument();
  });

  it('keeps row counts in sync between the titles pane and the chart pane', async () => {
    render(<ProjectTimeline projectId={project.id} />, { wrapper: createWrapper() });

    await screen.findByRole('img', { name: /Design hero section/ });
    const overlay = document.querySelector('svg[viewBox^="0 0 100"]');
    expect(overlay).not.toBeNull();
    // viewBox height = rows * 36 ⇒ 2 rows.
    expect(overlay?.getAttribute('viewBox')).toBe('0 0 100 72');
    expect(within(document.body).getAllByText(/Design hero section|Set up CI/).length).toBeGreaterThanOrEqual(2);
  });
});
