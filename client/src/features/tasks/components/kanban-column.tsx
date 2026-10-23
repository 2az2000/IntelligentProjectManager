'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useErrorMessage } from '@/hooks/use-error-message';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Label } from '@/features/labels';
import { StatusDot, type ProjectStatus } from '@/features/statuses';
import { useCreateTask } from '../hooks/use-tasks';
import type { Task } from '../types';
import { SortableTaskCard } from './task-card';

export function KanbanColumn({
  projectId,
  status,
  tasks,
  labels,
  readOnly,
  onOpen,
  limit,
}: {
  projectId: number;
  /** The project's workflow column this stack belongs to. */
  status: ProjectStatus;
  tasks: Task[];
  /** The project's label vocabulary, passed straight through to the cards. */
  labels?: Label[];
  readOnly: boolean;
  onOpen: (taskId: number) => void;
  /** §4 WIP limit of this column (undefined = unlimited). */
  limit?: number;
}) {
  const t = useTranslations('Tasks');
  const ts = useTranslations('Tasks.status');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { setNodeRef, isOver } = useDroppable({ id: status.key, disabled: readOnly });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const createTask = useCreateTask(projectId);
  const full = limit !== undefined && tasks.length >= limit;

  // Built-in columns read in the user's language; a custom column shows its own label.
  const label = ts.has(status.key) ? ts(status.key) : status.label;

  const submit = () => {
    const value = title.trim();
    if (!value) return setAdding(false);
    createTask.mutate(
      { title: value, statusKey: status.key },
      {
        onSuccess: () => setTitle(''),
        onError: (error) => toast.error(toMessage(error)),
      },
    );
  };

  return (
    <section className="flex w-72 shrink-0 flex-col" aria-label={label}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 font-semibold">
          <StatusDot color={status.color} />
          {label}
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-mono text-xs',
              full ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground',
            )}
          >
            {limit === undefined
              ? formatNumber(tasks.length, locale)
              : `${formatNumber(tasks.length, locale)}/${formatNumber(limit, locale)}`}
          </span>
        </h3>
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t('addToColumn', { column: label })}
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[420px] flex-1 flex-col rounded-xl bg-muted/50 p-2',
          // Keep the target feedback soft and slow enough to follow the pointer smoothly.
          'transition-[background-color,box-shadow] duration-200 ease-out',
          // §4 WIP limit: a full column is visible before anyone drags another card in.
          full && 'ring-2 ring-destructive/40 ring-inset',
          isOver && 'bg-primary/5 ring-2 ring-primary/35 ring-inset',
        )}
      >
        {adding && (
          <Input
            autoFocus
            className="mb-2 bg-background"
            placeholder={t('titlePlaceholder')}
            value={title}
            disabled={createTask.isPending}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => !title.trim() && setAdding(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') {
                setTitle('');
                setAdding(false);
              }
            }}
          />
        )}
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} labels={labels} disabled={readOnly} onOpen={onOpen} />
          ))}
        </SortableContext>
        {tasks.length === 0 && !adding && (
          <div className="flex h-20 items-center justify-center rounded-lg border-2 border-dashed text-xs text-muted-foreground">
            {t('dropHere')}
          </div>
        )}
      </div>
    </section>
  );
}
