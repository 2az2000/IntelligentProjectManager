'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, MessageSquare } from 'lucide-react';
import { useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { LabelChip, labelByName, type Label } from '@/features/labels';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Task } from '../types';
import { DueDate, PriorityBadge } from './task-badges';
import { AssigneeStack } from './task-fields';

export function TaskCardView({
  task,
  dragging,
  labels,
  onOpen,
}: {
  task: Task;
  dragging?: boolean;
  /** The project's label vocabulary — gives matching tags their colour and icon. */
  labels?: Label[];
  onOpen?: () => void;
}) {
  const locale = useLocale();
  const n = (value: number) => formatNumber(value, locale);

  return (
    <div
      onClick={onOpen}
      className={cn(
        'flex flex-col gap-2 rounded-lg border bg-card p-3 text-start shadow-xs transition-[box-shadow,transform] duration-150',
        onOpen && 'cursor-pointer hover:-translate-y-px hover:shadow-md',
        // The lifted overlay card: tilted, raised and clearly "in hand".
        dragging && 'rotate-[1.5deg] scale-[1.03] cursor-grabbing shadow-2xl ring-2 ring-primary',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug font-medium">{task.title}</p>
        <PriorityBadge priority={task.priority} className="shrink-0" />
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            // Colour + icon come from the project's vocabulary; unknown tags stay plain.
            <LabelChip key={tag} name={tag} label={labelByName(labels, tag)} className="h-5 text-[10px]" />
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
        <AssigneeStack assignees={task.assignees} />
      </div>
    </div>
  );
}

export function SortableTaskCard({
  task,
  disabled,
  labels,
  onOpen,
}: {
  task: Task;
  disabled?: boolean;
  labels?: Label[];
  onOpen: (taskId: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    // The board resolves a drop target from this key when the pointer is over a card.
    data: { statusKey: task.statusKey },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      // While dragging, `DragOverlay` is the card the user sees moving. Leaving the transform
      // on this node too would draw a second, semi-transparent card under the pointer.
      style={isDragging ? undefined : { transform: CSS.Transform.toString(transform), transition }}
      className={cn('mb-2 rounded-lg', !disabled && 'cursor-grab touch-none active:cursor-grabbing')}
      {...attributes}
      {...listeners}
      onKeyDown={(event) => {
        // Enter opens the task; Space remains the keyboard drag key.
        if (event.key === 'Enter') onOpen(task.id);
        else listeners?.onKeyDown?.(event);
      }}
    >
      {isDragging ? (
        // Keep the exact slot (so nothing jumps) but mark it as "the card left from here".
        <div className="rounded-lg outline-2 outline-dashed outline-primary/40">
          <div className="invisible" aria-hidden>
            <TaskCardView task={task} labels={labels} />
          </div>
        </div>
      ) : (
        <TaskCardView task={task} labels={labels} onOpen={() => onOpen(task.id)} />
      )}
    </div>
  );
}
