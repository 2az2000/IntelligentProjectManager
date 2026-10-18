'use client';

import { AlarmClock, CalendarClock, CalendarRange, CheckCircle2, Inbox, Timer, TriangleAlert } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/shared/error-state';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { PriorityBadge, useTaskSheet } from '@/features/tasks';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDigest } from '../hooks/use-dashboard';
import type { DashboardDigest, DigestTask } from '../api/dashboard.api';

/**
 * §5 daily digest report: opened from the DAILY_DIGEST notification (bell item or its toast).
 * Shows the same payload the 08:00 email carried, refreshed on open — the numbers are the
 * headline, the task list and the per-project split are the actual report.
 */
export function DigestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Notifications.digest');
  const { openTask } = useTaskSheet();
  const fresh = useDigest(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        {fresh.isPending ? (
          <TableSkeleton rows={4} />
        ) : fresh.isError ? (
          <ErrorState error={fresh.error} onRetry={() => fresh.refetch()} />
        ) : fresh.data ? (
          <DigestReport digest={fresh.data} onOpenTask={(id) => { onOpenChange(false); openTask(id); }} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DigestReport({
  digest,
  onOpenTask,
}: {
  digest: DashboardDigest;
  onOpenTask: (taskId: number) => void;
}) {
  const t = useTranslations('Notifications.digest');
  const locale = useLocale();
  const overdue = digest.tasks.filter((task) => task.overdue);
  const dueToday = digest.tasks.filter((task) => !task.overdue);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          icon={<CalendarClock className="size-3.5" aria-hidden />}
          label={t('dueToday')}
          value={digest.dueToday}
          emphasis={digest.dueToday > 0}
        />
        <Stat
          icon={<AlarmClock className="size-3.5" aria-hidden />}
          label={t('overdue')}
          value={digest.overdue}
          emphasis={digest.overdue > 0}
          destructive
        />
        <Stat
          icon={<CalendarRange className="size-3.5" aria-hidden />}
          label={t('dueThisWeek')}
          value={digest.dueThisWeek}
        />
        <Stat icon={<Timer className="size-3.5" aria-hidden />} label={t('inProgress')} value={digest.inProgress} />
        <Stat
          icon={<CheckCircle2 className="size-3.5" aria-hidden />}
          label={t('completedSinceYesterday')}
          value={digest.completedSinceYesterday}
        />
        <Stat icon={<Inbox className="size-3.5" aria-hidden />} label={t('open')} value={digest.open} />
      </div>

      {digest.overdueByDays > 0 && (
        <p className="text-destructive -mt-2 flex items-center gap-1.5 text-xs">
          <TriangleAlert className="size-3.5" aria-hidden />
          {t('oldestOverdue', { days: digest.overdueByDays })}
        </p>
      )}

      {digest.tasks.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('empty')}</p>
      ) : (
        <>
          {overdue.length > 0 && (
            <TaskSection
              title={t('overdue')}
              tasks={overdue}
              locale={locale}
              onOpenTask={onOpenTask}
            />
          )}
          {dueToday.length > 0 && (
            <TaskSection title={t('dueToday')} tasks={dueToday} locale={locale} onOpenTask={onOpenTask} />
          )}
        </>
      )}

      {digest.perProject.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('byProject')}</h3>
          <ul className="divide-y rounded-md border text-sm">
            {digest.perProject.map((project) => (
              <li key={project.projectId} className="flex items-center justify-between gap-3 px-3 py-1.5">
                <span className="min-w-0 truncate">{project.projectName}</span>
                <span className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
                  <span className="tabular-nums">{t('openCount', { count: project.open })}</span>
                  {project.overdue > 0 && (
                    <Badge variant="destructive" className="tabular-nums">
                      {t('overdueCount', { count: project.overdue })}
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  emphasis = false,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  emphasis?: boolean;
  destructive?: boolean;
}) {
  const locale = useLocale();
  return (
    <div className={cn('rounded-lg border p-3', emphasis && 'border-destructive/40')}>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          destructive && value > 0 && 'text-destructive',
        )}
      >
        {formatNumber(value, locale)}
      </p>
    </div>
  );
}

function TaskSection({
  title,
  tasks,
  locale,
  onOpenTask,
}: {
  title: string;
  tasks: DigestTask[];
  locale: string;
  onOpenTask: (taskId: number) => void;
}) {
  const t = useTranslations('Notifications.digest');

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      <ul className="divide-y rounded-md border" role="list">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              className="hover:bg-muted/60 flex w-full items-start justify-between gap-3 px-3 py-2 text-start"
              onClick={() => onOpenTask(task.id)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{task.title}</span>
                <span className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                  <span className="truncate">{task.projectName}</span>
                  {task.dueDate && <span>· {formatDate(task.dueDate, locale, { month: 'short', day: 'numeric' })}</span>}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <PriorityBadge priority={task.priority} />
                {task.overdueByDays > 0 && (
                  <Badge variant="destructive" className="tabular-nums">
                    {t('overdueBy', { days: task.overdueByDays })}
                  </Badge>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
