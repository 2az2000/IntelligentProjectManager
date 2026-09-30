'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ErrorState } from '@/components/shared/error-state';
import {
  addMonths,
  calendarFor,
  dayLabel,
  isSameDay,
  isSameMonth,
  monthGrid,
  monthLabel,
  startOfDay,
  weekdayLabels,
} from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { useCalendarTasks } from '../hooks/use-tasks';
import { useTaskSheet } from '../hooks/use-task-sheet';
import { isOverdue, type Task } from '../types';

const MAX_PER_DAY = 3;

const dayKey = (date: Date) => startOfDay(date).toISOString();

/** Month view of tasks by due date, in the locale's calendar (Jalali for fa). */
export function TaskCalendar() {
  const t = useTranslations('Calendar');
  const locale = useLocale();
  const system = calendarFor(locale);
  const { openTask } = useTaskSheet();
  const [month, setMonth] = useState(() => new Date());
  const [scope, setScope] = useState<'mine' | 'all'>('mine');

  const weeks = useMemo(() => monthGrid(month, system), [month, system]);
  const from = weeks[0]![0]!;
  const to = new Date(weeks.at(-1)!.at(-1)!.getTime() + 24 * 60 * 60 * 1000 - 1);
  const { data: tasks, isError, error, refetch, isFetching } = useCalendarTasks(
    from.toISOString(),
    to.toISOString(),
    scope,
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      if (!task.dueDate) continue;
      const key = dayKey(new Date(task.dueDate));
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [tasks]);

  const today = new Date();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label={t('previous')} onClick={() => setMonth((m) => addMonths(m, -1, system))}>
            <ChevronRight className="size-4 ltr:rotate-180" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMonth(new Date())}>
            {t('today')}
          </Button>
          <Button variant="outline" size="icon" aria-label={t('next')} onClick={() => setMonth((m) => addMonths(m, 1, system))}>
            <ChevronLeft className="size-4 ltr:rotate-180" />
          </Button>
          <h2 className={cn('ms-3 text-lg font-semibold', isFetching && 'opacity-60')} aria-live="polite">
            {monthLabel(month, locale)}
          </h2>
        </div>
        <Tabs value={scope} onValueChange={(v) => setScope(v as 'mine' | 'all')}>
          <TabsList>
            <TabsTrigger value="mine">{t('mine')}</TabsTrigger>
            <TabsTrigger value="all">{t('all')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <div className="grid min-w-[700px] grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
            {weekdayLabels(weeks[0]!, locale).map((label) => (
              <div key={label} className="py-2">
                {label}
              </div>
            ))}
          </div>
          <div className="grid min-w-[700px] grid-cols-7">
            {weeks.flat().map((day) => {
              const dayTasks = byDay.get(dayKey(day)) ?? [];
              const inMonth = isSameMonth(day, month, system);
              return (
                <div
                  key={day.toISOString()}
                  className={cn('min-h-28 border-e border-b p-1.5 [&:nth-child(7n)]:border-e-0', !inMonth && 'bg-muted/30')}
                >
                  <div
                    className={cn(
                      'mb-1 flex size-6 items-center justify-center rounded-full text-xs',
                      !inMonth && 'text-muted-foreground/60',
                      isSameDay(day, today) && 'bg-primary font-bold text-primary-foreground',
                    )}
                  >
                    {dayLabel(day, locale)}
                  </div>
                  <ul className="flex flex-col gap-1">
                    {dayTasks.slice(0, MAX_PER_DAY).map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => openTask(task.id)}
                          title={`${task.title} — ${task.project.name}`}
                          className={cn(
                            'w-full truncate rounded border-s-2 bg-card px-1.5 py-0.5 text-start text-[11px] shadow-xs hover:bg-accent',
                            task.status === 'DONE'
                              ? 'border-s-muted-foreground text-muted-foreground line-through'
                              : isOverdue(task)
                                ? 'border-s-destructive'
                                : 'border-s-primary',
                          )}
                        >
                          {task.title}
                        </button>
                      </li>
                    ))}
                    {dayTasks.length > MAX_PER_DAY && (
                      <li className="px-1 text-[11px] text-muted-foreground">
                        {t('more', { count: dayTasks.length - MAX_PER_DAY })}
                      </li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
