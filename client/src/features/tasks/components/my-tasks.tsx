'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { useErrorMessage } from '@/hooks/use-error-message';
import { startOfDay } from '@/lib/calendar';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMyTasks, useUpdateTask } from '../hooks/use-tasks';
import { useTaskSheet } from '../hooks/use-task-sheet';
import type { Task } from '../types';
import { DueDate, PriorityBadge } from './task-badges';

type Group = 'overdue' | 'today' | 'week' | 'later' | 'noDate' | 'done';
const GROUPS: Group[] = ['overdue', 'today', 'week', 'later', 'noDate', 'done'];
const DAY = 24 * 60 * 60 * 1000;

function groupOf(task: Task, today: Date): Group {
  if (task.status === 'DONE') return 'done';
  if (!task.dueDate) return 'noDate';
  const due = new Date(task.dueDate).getTime();
  const start = today.getTime();
  if (due < start) return 'overdue';
  if (due < start + DAY) return 'today';
  if (due < start + 7 * DAY) return 'week';
  return 'later';
}

export function MyTasks() {
  const t = useTranslations('MyTasks');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { openTask } = useTaskSheet();
  const [showDone, setShowDone] = useState(false);
  const { data: tasks, isPending, isError, error, refetch } = useMyTasks(showDone);
  const update = useUpdateTask();

  const groups = useMemo(() => {
    const today = startOfDay(new Date());
    const map = new Map<Group, Task[]>(GROUPS.map((g) => [g, []]));
    for (const task of tasks ?? []) map.get(groupOf(task, today))!.push(task);
    return map;
  }, [tasks]);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Checkbox id="show-done" checked={showDone} onCheckedChange={(v) => setShowDone(v === true)} />
        <Label htmlFor="show-done">{t('showDone')}</Label>
      </div>

      {isPending ? (
        <TableSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={t('empty')} description={t('emptyDescription')} />
      ) : (
        GROUPS.filter((g) => groups.get(g)!.length > 0).map((group) => (
          <Card key={group} className="gap-2">
            <CardHeader>
              <CardTitle className={cn('flex items-center gap-2 text-base', group === 'overdue' && 'text-destructive')}>
                {t(`groups.${group}`)}
                <span className="text-sm font-normal text-muted-foreground">
                  ({formatNumber(groups.get(group)!.length, locale)})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {groups.get(group)!.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 py-2">
                    <Checkbox
                      checked={task.status === 'DONE'}
                      aria-label={t('markDone', { title: task.title })}
                      onCheckedChange={(checked) =>
                        update.mutate(
                          { taskId: task.id, input: { status: checked ? 'DONE' : 'TODO' } },
                          { onError: (e) => toast.error(toMessage(e)) },
                        )
                      }
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 flex-col items-start text-start"
                      onClick={() => openTask(task.id)}
                    >
                      <span className={cn('truncate text-sm font-medium', task.status === 'DONE' && 'text-muted-foreground line-through')}>
                        {task.title}
                      </span>
                      <span className="text-xs text-muted-foreground">{task.project.name}</span>
                    </button>
                    <DueDate task={task} />
                    <PriorityBadge priority={task.priority} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
