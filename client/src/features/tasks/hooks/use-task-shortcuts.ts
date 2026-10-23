'use client';

import { useEffect } from 'react';

/** Opens the "new task" dialog from anywhere on the project page. */
export const OPEN_CREATE_TASK_EVENT = 'open-create-task';
/** Focuses the global search box (the `/` shortcut). */
export const FOCUS_SEARCH_EVENT = 'focus-global-search';

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

const isTyping = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return EDITABLE.has(element.tagName) || element.isContentEditable;
};

const dialogOpen = () => document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;

/** Focusable task surfaces of the current view, in visual order. */
const taskElements = () => [
  ...document.querySelectorAll<HTMLElement>('[data-task-id]:not([hidden])'),
];

/**
 * §4 keyboard shortcuts — `C` new task, `/` search, `J`/`K` move between cards (or rows),
 * `1`–`4` set the focused task's workflow column, `?` opens the help sheet.
 *
 * Deliberately inert while typing, inside dialogs, or with a modifier held: the browser and the
 * form fields keep their own keys.
 */
export function useTaskShortcuts({
  enabled = true,
  canEdit,
  onStatus,
  onHelp,
}: {
  enabled?: boolean;
  canEdit: boolean;
  /** Applies the n-th workflow column (1-based) of the project to the focused task. */
  onStatus: (taskId: number, slot: 1 | 2 | 3 | 4) => void;
  onHelp: () => void;
}) {
  useEffect(() => {
    if (!enabled) return;

    const focusAt = (index: number) => {
      const elements = taskElements();
      const target = elements[Math.min(Math.max(index, 0), elements.length - 1)];
      target?.focus();
      // jsdom (tests) has no layout; the browser scrolls the focused card into view.
      target?.scrollIntoView?.({ block: 'nearest' });
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target) || dialogOpen()) return;

      const key = event.key;
      if (key === '/') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(FOCUS_SEARCH_EVENT));
        return;
      }
      if (key === '?') {
        event.preventDefault();
        onHelp();
        return;
      }
      if (key.toLowerCase() === 'c') {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_CREATE_TASK_EVENT));
        return;
      }
      if (key.toLowerCase() === 'j' || key.toLowerCase() === 'k') {
        event.preventDefault();
        const elements = taskElements();
        const current = elements.indexOf(document.activeElement as HTMLElement);
        // J/K step through the visible order; the first key press starts at the top.
        const step = key.toLowerCase() === 'j' ? 1 : -1;
        focusAt(current < 0 ? 0 : current + step);
        return;
      }
      if (/^[1-4]$/.test(key) && canEdit) {
        const focused = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
          '[data-task-id]',
        );
        const taskId = Number(focused?.dataset.taskId);
        if (!Number.isInteger(taskId) || taskId <= 0) return;
        event.preventDefault();
        onStatus(taskId, Number(key) as 1 | 2 | 3 | 4);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, canEdit, onStatus, onHelp]);
}
