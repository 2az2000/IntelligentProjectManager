import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import type { TaskDateConflict } from '../types';
import { DateConflictNotice } from './date-conflict-notice';

const messages = (await import('../../../../messages/fa.json')).default;

function createWrapper() {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <NextIntlClientProvider locale="fa" messages={messages}>
        {children}
      </NextIntlClientProvider>
    );
  };
}

const predecessor: TaskDateConflict = {
  code: 'DEPENDENCY_DATE_CONFLICT',
  direction: 'predecessor',
  relatedTaskId: 7,
  relatedTaskTitle: 'Design',
  conflictDays: 3,
};

const successor: TaskDateConflict = {
  code: 'DEPENDENCY_DATE_CONFLICT',
  direction: 'successor',
  relatedTaskId: 9,
  relatedTaskTitle: 'Ship',
  conflictDays: 1,
};

describe('DateConflictNotice', () => {
  it('renders nothing without conflicts', () => {
    const { container } = render(
      <DateConflictNotice conflicts={[]} onOpenTask={() => {}} onDismiss={() => {}} />,
      { wrapper: createWrapper() },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('names each clashing task and opens it', async () => {
    const onOpenTask = vi.fn();
    render(
      <DateConflictNotice
        conflicts={[predecessor, successor]}
        onOpenTask={onOpenTask}
        onDismiss={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Design');
    expect(banner).toHaveTextContent('Ship');
    expect(banner).toHaveTextContent('بعد از شروع این تسک تمام می‌شود');
    expect(banner).toHaveTextContent('قبل از پایان این تسک شروع می‌شود');

    await userEvent.click(screen.getAllByRole('button', { name: 'باز کردن' })[0]!);
    expect(onOpenTask).toHaveBeenCalledWith(7);
  });

  it('can be dismissed', async () => {
    const onDismiss = vi.fn();
    render(<DateConflictNotice conflicts={[predecessor]} onOpenTask={() => {}} onDismiss={onDismiss} />, {
      wrapper: createWrapper(),
    });

    await userEvent.click(screen.getByRole('button', { name: 'بستن' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});
