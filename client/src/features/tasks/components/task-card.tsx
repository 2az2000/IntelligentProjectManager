'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, MessageSquare } from 'lucide-react';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/shared/user-avatar';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Task } from '../types';
import { DueDate, PriorityBadge } from './task-badges';

export function TaskCardView({
  task,
  dragging,
  onOpen,
}: {
  task: Task;
  dragging?: boolean;
  onOpen?: () => void;
}) {
  const locale = useLocale();
  const n = (value: number) => formatNumber(value, locale);

  return (
    <div
      onClick={onOpen}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-3 text-start shadow-xs transition-shadow hover:shadow-md',
        onOpen && 'cursor-pointer',
        dragging && 'shadow-lg ring-2 ring-primary',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug font-medium">{task.title}</p>
        <PriorityBadge priority={task.priority} className="shrink-0" />
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <DueDate task={task} />
          {task.subtaskCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckSquare className="size-3" aria-hidden />
              {n(task.doneSubtaskCount)}/{n(task.subtaskCount)}
            </span>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" aria-hidden />
              {n(task.commentCount)}
            </span>
          )}
          {task.points != null && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {n(task.points)}
            </Badge>
          )}
        </div>
        {task.assignee && <UserAvatar user={task.assignee} className="size-6" />}
      </div>
    </div>
  );
}

export function SortableTaskCard({
  task,
  disabled,
  onOpen,
}: {
  task: Task;
  disabled?: boolean;
  onOpen: (taskId: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('mb-2 rounded-lg', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
      onKeyDown={(event) => {
        // Enter opens the task; Space remains the keyboard drag key.
        if (event.key === 'Enter') onOpen(task.id);
        else listeners?.onKeyDown?.(event);
      }}
    >
      <TaskCardView task={task} onOpen={() => onOpen(task.id)} />
    </div>
  );
}
