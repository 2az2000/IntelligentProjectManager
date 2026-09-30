'use client';

import { AlertTriangle, CalendarClock, CheckCircle2, ListTodo, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { DueDate, PriorityBadge, TASK_STATUSES, useTaskSheet } from '@/features/tasks';
import { Link } from '@/i18n/navigation';
import { formatNumber, formatPercent, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDashboardSummary } from '../hooks/use-dashboard';
import type { DashboardSummary } from '../api/dashboard.api';

export function DashboardView() {
  const { data, isPending, isError, error, refetch } = useDashboardSummary();

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StatTiles summary={data} />
      <div className="grid gap-6 lg:grid-cols-3">
        <StatusBreakdown byStatus={data.byStatus} />
        <Upcoming items={data.upcoming} />
      </div>
      <RecentProjects items={data.recentProjects} />
    </div>
  );
}

function StatTiles({ summary }: { summary: DashboardSummary }) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  const tiles: { key: string; value: number; icon: LucideIcon; alert?: boolean }[] = [
    { key: 'myOpenTasks', value: summary.myOpenTasks, icon: ListTodo },
    { key: 'overdue', value: summary.overdue, icon: AlertTriangle, alert: summary.overdue > 0 },
    { key: 'dueThisWeek', value: summary.dueThisWeek, icon: CalendarClock },
    { key: 'completedThisWeek', value: summary.completedThisWeek, icon: CheckCircle2 },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map(({ key, value, icon: Icon, alert }) => (
        <Card key={key} className="gap-2 py-4">
          <CardHeader className="flex flex-row items-center justify-between px-4">
            <CardDescription>{t(`stats.${key}`)}</CardDescription>
            <Icon className={cn('size-4 text-muted-foreground', alert && 'text-destructive')} aria-hidden />
          </CardHeader>
          <CardContent className="px-4">
            <p className={cn('text-3xl font-bold tabular-nums', alert && 'text-destructive')}>
              {formatNumber(value, locale)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Tasks per status across my projects: one measure over four categories ⇒ horizontal bars in a
 * single hue, each directly labelled with its count and share (no legend needed).
 */
function StatusBreakdown({ byStatus }: { byStatus: DashboardSummary['byStatus'] }) {
  const t = useTranslations('Dashboard');
  const ts = useTranslations('Tasks.status');
  const locale = useLocale();
  const total = TASK_STATUSES.reduce((sum, s) => sum + byStatus[s], 0);
  const max = Math.max(1, ...TASK_STATUSES.map((s) => byStatus[s]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('byStatusTitle')}</CardTitle>
        <CardDescription>{t('byStatusDescription', { total: formatNumber(total, locale) })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {TASK_STATUSES.map((status) => {
            const count = byStatus[status];
            const share = total === 0 ? 0 : count / total;
            return (
              <li
                key={status}
                className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm"
                title={`${ts(status)}: ${formatNumber(count, locale)} (${formatPercent(share, locale)})`}
              >
                <span className="truncate text-muted-foreground">{ts(status)}</span>
                <span className="h-3 rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-chart-1 transition-[width]"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </span>
                <span className="w-16 text-end tabular-nums">
                  {formatNumber(count, locale)}{' '}
                  <span className="text-xs text-muted-foreground">{formatPercent(share, locale)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function Upcoming({ items }: { items: DashboardSummary['upcoming'] }) {
  const t = useTranslations('Dashboard');
  const { openTask } = useTaskSheet();

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t('upcomingTitle')}</CardTitle>
        <Link href="/my-tasks" className="text-sm text-primary hover:underline">
          {t('viewAll')}
        </Link>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={t('noUpcoming')} className="py-8" />
        ) : (
          <ul className="divide-y">
            {items.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() => openTask(task.id)}
                  className="flex w-full items-center gap-3 py-2 text-start hover:bg-muted/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{task.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{task.project.name}</span>
                  </span>
                  <DueDate task={task} />
                  <PriorityBadge priority={task.priority} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecentProjects({ items }: { items: DashboardSummary['recentProjects'] }) {
  const t = useTranslations('Dashboard');
  const locale = useLocale();
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('recentProjects')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {items.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}/board`}
            className="flex flex-col rounded-lg border px-3 py-2 transition-colors hover:bg-muted/60"
          >
            <span className="text-sm font-medium">{p.name}</span>
            <span className="text-xs text-muted-foreground">{formatRelative(p.updatedAt, locale)}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
