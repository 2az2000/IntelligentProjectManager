'use client';

import { ArrowDown, ArrowUp, Flame, Minus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { isOverdue, type Task, type TaskPriority, type TaskStatus } from '../types';

const PRIORITY_ICON = { LOW: ArrowDown, MEDIUM: Minus, HIGH: ArrowUp, URGENT: Flame } as const;

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const t = useTranslations('Tasks.priority');
  const Icon = PRIORITY_ICON[priority];
  const strong = priority === 'HIGH' || priority === 'URGENT';
  return (
    <Badge variant={strong ? 'destructive' : 'secondary'} className={cn('gap-1 text-[10px]', className)}>
      <Icon className="size-3" aria-hidden />
      {t(priority)}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const t = useTranslations('Tasks.status');
  return <Badge variant="outline">{t(status)}</Badge>;
}

/** Due date with overdue emphasis (icon + text, not color alone). */
export function DueDate({ task, className }: { task: Pick<Task, 'dueDate' | 'status'>; className?: string }) {
  const t = useTranslations('Tasks');
  const locale = useLocale();
  if (!task.dueDate) return null;
  const overdue = isOverdue(task);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        overdue ? 'font-medium text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      {formatDate(task.dueDate, locale, { month: 'short', day: 'numeric' })}
      {overdue && <span>· {t('overdue')}</span>}
    </span>
  );
}
