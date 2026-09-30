'use client';

import { AlertTriangle, FolderKanban, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { CardGridSkeleton } from '@/components/shared/loading-skeletons';
import { UserAvatar } from '@/components/shared/user-avatar';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTeam } from '../hooks/use-projects';

/** Everyone I share a project with, and their open workload (story points) across those projects. */
export function TeamGrid() {
  const t = useTranslations('Members');
  const locale = useLocale();
  const n = (v: number) => formatNumber(v, locale);
  const { data: team, isPending, isError, error, refetch } = useTeam();

  if (isPending) return <CardGridSkeleton count={3} />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (team.length === 0) return <EmptyState icon={Users} title={t('empty')} />;

  const maxPoints = Math.max(1, ...team.map((m) => m.openPoints));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {team.map((m) => (
        <Card key={m.user.id} className="gap-4">
          <CardHeader className="flex flex-row items-center gap-3">
            <UserAvatar user={m.user} className="size-10" />
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{m.user.name}</CardTitle>
              <CardDescription className="truncate" dir="ltr">
                {m.user.email}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div
              className="flex flex-col gap-1"
              title={t('workloadTooltip', { points: n(m.openPoints), tasks: n(m.openTasks) })}
            >
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('workload')}</span>
                <span className="font-medium text-foreground">{t('points', { count: n(m.openPoints) })}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(m.openPoints / maxPoints) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{t('openTasks', { count: n(m.openTasks) })}</span>
              <span className="flex items-center gap-1">
                <FolderKanban className="size-3.5" aria-hidden />
                {t('projects', { count: n(m.projectCount) })}
              </span>
              <span className={cn('flex items-center gap-1', m.overdueTasks > 0 && 'font-medium text-destructive')}>
                {m.overdueTasks > 0 && <AlertTriangle className="size-3.5" aria-hidden />}
                {t('overdue', { count: n(m.overdueTasks) })}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
