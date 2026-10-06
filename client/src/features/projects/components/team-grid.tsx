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

/**
 * §6 workload heatmap: everyone I share a project with, color-coded by open
 * workload relative to the busiest member (≤50% green, ≤85% amber, red above).
 */
function loadClass(ratio: number): string {
  if (ratio <= 0.5) return 'bg-emerald-500/80';
  if (ratio <= 0.85) return 'bg-amber-500/80';
  return 'bg-red-500/80';
}

function loadLabel(ratio: number): 'loadLow' | 'loadMedium' | 'loadHigh' {
  if (ratio <= 0.5) return 'loadLow';
  if (ratio <= 0.85) return 'loadMedium';
  return 'loadHigh';
}

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
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span>{t('heatLegend')}</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-emerald-500/80" /> {t('loadLow')}</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-amber-500/80" /> {t('loadMedium')}</span>
        <span className="flex items-center gap-1"><span className="size-3 rounded-sm bg-red-500/80" /> {t('loadHigh')}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {team.map((m) => {
          const ratio = m.openPoints / maxPoints;
          return (
            <Card key={m.user.id} className={cn('gap-4', ratio > 0.85 && 'border-red-500/40')}>
              <CardHeader className="flex flex-row items-center gap-3">
                <UserAvatar user={m.user} className="size-10" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="truncate text-base">{m.user.name}</CardTitle>
                  <CardDescription className="truncate" dir="ltr">
                    {m.user.email}
                  </CardDescription>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium text-white',
                    loadClass(ratio),
                  )}
                >
                  {t(loadLabel(ratio))}
                </span>
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
                      className={cn('h-full rounded-full transition-[width]', loadClass(ratio))}
                      style={{ width: `${ratio * 100}%` }}
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
          );
        })}
      </div>
    </div>
  );
}
