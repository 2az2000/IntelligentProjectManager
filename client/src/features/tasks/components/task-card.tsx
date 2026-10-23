'use client';

import { useState, type SyntheticEvent } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckSquare, ChevronDown, Circle, CircleCheck, MessageSquare } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { LabelChip, labelByName, type Label } from '@/features/labels';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTask } from '../hooks/use-tasks';
import type { Task } from '../types';
import { DueDate, PriorityBadge } from './task-badges';
import { AssigneeStack } from './task-fields';

/**
 * The `3/5` badge, made useful: opening it lists the subtasks in place so a parent card can be
 * tracked without opening the sheet. The detail query only runs while the popover is mounted.
 */
function SubtaskPeek({ task, onOpenTask }: { task: Task; onOpenTask?: (taskId: number) => void }) {
  const t = useTranslations('Tasks');
  const locale = useLocale();
  const n = (value: number) => formatNumber(value, locale);
  const [open, setOpen] = useState(false);

  // The card underneath is a click target and a drag handle; the badge must do neither.
  const isolate = (event: SyntheticEvent) => event.stopPropagation();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('viewSubtasks')}
          className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={isolate}
          onPointerDown={isolate}
        >
          <CheckSquare className="size-3" aria-hidden />
          {n(task.doneSubtaskCount)}/{n(task.subtaskCount)}
          <ChevronDown className={cn('size-3 opacity-60 transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2" onClick={isolate} onPointerDown={isolate}>
        <SubtaskPeekList taskId={task.id} onOpenTask={onOpenTask} />
      </PopoverContent>
    </Popover>
  );
}

function SubtaskPeekList({ taskId, onOpenTask }: { taskId: number; onOpenTask?: (taskId: number) => void }) {
  const t = useTranslations('Tasks');
  const { data, isPending } = useTask(taskId);
  const subtasks = data?.subtasks ?? [];

  return (
    <div className="flex flex-col gap-1">
      <p className="px-1 pb-1 text-xs font-medium text-muted-foreground">{t('subtasks')}</p>
      {isPending && <Skeleton className="h-14 w-full" />}
      {!isPending && subtasks.length === 0 && (
        <p className="px-1 py-2 text-xs text-muted-foreground">{t('noSubtasks')}</p>
      )}
      {subtasks.map((subtask) => {
        const done = subtask.status === 'DONE';
        const Icon = done ? CircleCheck : Circle;
        const body = (
          <>
            <Icon className={cn('size-3.5 shrink-0', done ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} aria-hidden />
            <span className={cn('flex-1 truncate text-start text-sm', done && 'text-muted-foreground line-through')}>
              {subtask.title}
            </span>
          </>
        );
        return onOpenTask ? (
          <button
            key={subtask.id}
            type="button"
            onClick={() => onOpenTask(subtask.id)}
            className="flex items-center gap-2 rounded-md px-1 py-1 text-start hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {body}
          </button>
        ) : (
          <div key={subtask.id} className="flex items-center gap-2 px-1 py-1">
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function TaskCardView({
  task,
  dragging,
  labels,
  onOpen,
  onOpenTask,
}: {
  task: Task;
  dragging?: boolean;
  /** The project's label vocabulary — gives matching tags their colour and icon. */
  labels?: Label[];
  onOpen?: () => void;
  /** Opens a subtask from the peek popover (same sheet as the parent). */
  onOpenTask?: (taskId: number) => void;
}) {
  const locale = useLocale();
  const n = (value: number) => formatNumber(value, locale);

  return (
    <div
      onClick={onOpen}
      data-task-id={task.id}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={(event) => {
        if (onOpen && event.key === 'Enter' && event.target === event.currentTarget) onOpen();
      }}
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
          {task.subtaskCount > 0 && <SubtaskPeek task={task} onOpenTask={onOpenTask} />}
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
        // Keys from a focused child (the subtask peek button) belong to that child, not to the
        // card — otherwise Enter would open the parent sheet as well as the popover.
        if (event.target !== event.currentTarget) return;
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
        <TaskCardView task={task} labels={labels} onOpen={() => onOpen(task.id)} onOpenTask={onOpen} />
      )}
    </div>
  );
}
