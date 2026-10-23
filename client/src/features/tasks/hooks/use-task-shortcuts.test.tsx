import { renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskShortcuts } from './use-task-shortcuts';

const setup = () => {
  const onStatus = vi.fn();
  const onHelp = vi.fn();
  renderHook(() => useTaskShortcuts({ canEdit: true, onStatus, onHelp }));
  return { onStatus, onHelp };
};

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('useTaskShortcuts', () => {
  it('broadcasts the new-task and search shortcuts', () => {
    setup();
    const create = vi.fn();
    const search = vi.fn();
    window.addEventListener('open-create-task', create);
    window.addEventListener('focus-global-search', search);

    fireEvent.keyDown(window, { key: 'c' });
    fireEvent.keyDown(window, { key: '/' });

    expect(create).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(1);
    window.removeEventListener('open-create-task', create);
    window.removeEventListener('focus-global-search', search);
  });

  it('moves focus with J/K and sets a column with 1–4', () => {
    const first = document.createElement('div');
    const second = document.createElement('div');
    first.dataset.taskId = '1';
    second.dataset.taskId = '2';
    first.tabIndex = 0;
    second.tabIndex = 0;
    document.body.append(first, second);

    const { onStatus } = setup();

    fireEvent.keyDown(window, { key: 'j' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(window, { key: 'j' });
    expect(document.activeElement).toBe(second);
    fireEvent.keyDown(window, { key: 'k' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(window, { key: '2' });
    expect(onStatus).toHaveBeenCalledWith(1, 2);
  });

  it('stays out of the way while typing or inside a dialog', () => {
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    const { onStatus, onHelp } = setup();

    fireEvent.keyDown(input, { key: 'c' });
    fireEvent.keyDown(input, { key: '?' });
    expect(onHelp).not.toHaveBeenCalled();
    expect(onStatus).not.toHaveBeenCalled();

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    fireEvent.keyDown(window, { key: '?' });
    expect(onHelp).not.toHaveBeenCalled();
  });

  it('opens the help sheet with ?', () => {
    const { onHelp } = setup();
    fireEvent.keyDown(window, { key: '?' });
    expect(onHelp).toHaveBeenCalledTimes(1);
  });
});
