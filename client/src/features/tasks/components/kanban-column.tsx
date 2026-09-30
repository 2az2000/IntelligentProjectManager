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
import { useCreateTask } from '../hooks/use-tasks';
import type { Task, TaskStatus } from '../types';
import { SortableTaskCard } from './task-card';

export function KanbanColumn({
  projectId,
  status,
  tasks,
  readOnly,
  onOpen,
}: {
  projectId: number;
  status: TaskStatus;
  tasks: Task[];
  readOnly: boolean;
  onOpen: (taskId: number) => void;
}) {
  const t = useTranslations('Tasks');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: readOnly });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const createTask = useCreateTask(projectId);

  const submit = () => {
    const value = title.trim();
    if (!value) return setAdding(false);
    createTask.mutate(
      { title: value, status },
      {
        onSuccess: () => setTitle(''),
        onError: (error) => toast.error(toMessage(error)),
      },
    );
  };

  return (
    <section className="flex w-72 shrink-0 flex-col" aria-label={t(`status.${status}`)}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 font-semibold">
          {t(`status.${status}`)}
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {formatNumber(tasks.length, locale)}
          </span>
        </h3>
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={t('addToColumn', { column: t(`status.${status}`) })}
            onClick={() => setAdding(true)}
          >
            <Plus className="size-4" />
          </Button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[420px] flex-1 flex-col rounded-xl bg-muted/50 p-2 transition-colors',
          isOver && 'bg-muted ring-2 ring-primary/30',
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
            <SortableTaskCard key={task.id} task={task} disabled={readOnly} onOpen={onOpen} />
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
