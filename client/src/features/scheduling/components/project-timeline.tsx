'use client';

import { useMemo } from 'react';
import { CalendarClock, Check, GitBranch, Loader2, TriangleAlert, Waypoints } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { useErrorMessage } from '@/hooks/use-error-message';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
// Deep imports keep the scheduling → projects/tasks graph acyclic (the header imports our barrel).
import { useProject } from '@/features/projects/hooks/use-projects';
import { hasRole } from '@/features/projects/types';
import { useApplySchedule, useDependencies, useSchedule } from '../hooks/use-schedule';
import {
  buildDependencyArrows,
  buildTimelineLayout,
  predictedFinish,
  type TimelineRow,
} from '../lib/timeline';

const ROW_HEIGHT = 36;

/** Gantt view of the project's CPM schedule, with critical path and slack. */
export function ProjectTimeline({ projectId }: { projectId: number }) {
  const t = useTranslations('Scheduling');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { data: project } = useProject(projectId);
  const { data: schedule, isPending, isError, error, refetch } = useSchedule(projectId);
  const { data: dependencies = [] } = useDependencies(projectId);
  const apply = useApplySchedule(projectId);

  const canApply = hasRole(project?.myRole ?? 'VIEWER', 'MEMBER');

  const layout = useMemo(() => (schedule ? buildTimelineLayout(schedule.tasks) : null), [schedule]);
  const arrows = useMemo(
    () => (layout && schedule ? buildDependencyArrows(layout, dependencies) : []),
    [layout, schedule, dependencies],
  );

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  if (isPending || !schedule || !layout) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-8 w-72" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (schedule.tasks.length === 0) {
    return <EmptyState icon={Waypoints} title={t('empty')} />;
  }

  const anchor = project?.startDate ? new Date(project.startDate) : new Date();
  const predicted = predictedFinish(schedule, anchor);
  const unestimatedCount = schedule.unestimatedTaskIds.length;
  const criticalCount = schedule.criticalPath.length;
  const chartHeight = layout.rows.length * ROW_HEIGHT;

  const applySchedule = () =>
    apply.mutate(undefined, {
      onSuccess: () => toast.success(t('applied')),
      onError: (err) => toast.error(toMessage(err)),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <GitBranch className="size-3.5" aria-hidden />
            {t('duration', { count: formatNumber(schedule.projectDurationHours, locale) })}
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <CalendarClock className="size-3.5" aria-hidden />
            {t('predictedFinish', { date: formatDate(predicted, locale) })}
          </Badge>
          <Badge variant="outline" className="gap-1">
            {t('criticalCount', { count: formatNumber(criticalCount, locale) })}
          </Badge>
        </div>
        {canApply && (
          <Button size="sm" onClick={applySchedule} disabled={apply.isPending}>
            {apply.isPending && <Loader2 className="me-2 size-4 animate-spin" aria-hidden />}
            {t('apply')}
          </Button>
        )}
      </div>

      {unestimatedCount > 0 && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {t('unestimated', { count: formatNumber(unestimatedCount, locale) })}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <div className="min-w-[560px]">
          <div className="flex">
            {/* Titles pane keeps the page direction; the chart pane is always LTR (time axis). */}
            <div className="w-56 shrink-0 py-2">
              {layout.rows.map((row) => (
                <div
                  key={row.task.id}
                  style={{ height: ROW_HEIGHT }}
                  className="flex items-center gap-1.5 px-3"
                >
                  {row.task.status === 'DONE' && <Check className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                  <span
                    dir="auto"
                    title={row.task.title}
                    className={cn(
                      'truncate text-sm',
                      row.task.status === 'DONE' && 'text-muted-foreground line-through',
                      row.task.isCritical && 'font-medium',
                    )}
                  >
                    {row.task.title}
                  </span>
                </div>
              ))}
            </div>

            <div dir="ltr" className="relative flex-1 border-s py-2">
              {layout.rows.map((row) => (
                <Bar key={row.task.id} row={row} />
              ))}
              {arrows.length > 0 && (
                <svg
                  aria-hidden
                  className="pointer-events-none absolute inset-0 size-full overflow-visible text-muted-foreground/60"
                  viewBox={`0 0 100 ${chartHeight}`}
                  preserveAspectRatio="none"
                >
                  {arrows.map((a) => {
                    const y1 = a.fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const y2 = a.toRow * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const elbowX = a.x2 > a.x1 ? (a.x1 + a.x2) / 2 : a.x1 + 1.5;
                    return (
                      <path
                        key={`${a.predecessorId}->${a.successorId}`}
                        d={`M ${a.x1} ${y1} L ${elbowX} ${y1} L ${elbowX} ${y2} L ${a.x2} ${y2}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>

      <Legend criticalLabel={t('legend.critical')} slackLabel={t('legend.slack')} doneLabel={t('legend.done')} unestimatedLabel={t('legend.unestimated')} />
    </div>
  );
}

function Bar({ row }: { row: TimelineRow }) {
  const t = useTranslations('Scheduling');
  const { task } = row;

  const label = t('barLabel', {
    title: task.title,
    estimate: task.estimateHours ?? 0,
    slack: task.slack ?? 0,
  });

  return (
    <div style={{ height: ROW_HEIGHT }} className="relative px-2">
      {row.hasBar ? (
        <>
          <div
            role="img"
            aria-label={label}
            title={label}
            style={{ left: `${row.leftPct}%`, width: `${row.widthPct}%` }}
            className={cn(
              'absolute top-2 h-4 rounded-md',
              task.status === 'DONE' ? 'bg-muted-foreground/30' : row.task.isCritical ? 'bg-primary' : 'bg-primary/50',
            )}
          />
          {row.slackPct > 0 && (
            <div
              aria-hidden
              style={{ left: `${row.leftPct + row.widthPct}%`, width: `${row.slackPct}%` }}
              className="absolute top-3 h-2 rounded-e-md border-s border-dashed border-muted-foreground/70 bg-muted-foreground/20"
            />
          )}
        </>
      ) : (
        <div
          aria-label={label}
          title={label}
          className="absolute top-2 h-4 w-2 rounded-md border border-dashed border-muted-foreground/60"
        />
      )}
    </div>
  );
}

function Legend({ criticalLabel, slackLabel, doneLabel, unestimatedLabel }: Record<'criticalLabel' | 'slackLabel' | 'doneLabel' | 'unestimatedLabel', string>) {
  const swatch = 'inline-block size-3 rounded-sm';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className={cn(swatch, 'bg-primary')} aria-hidden /> {criticalLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn(swatch, 'border-s border-dashed border-muted-foreground/70 bg-muted-foreground/20')} aria-hidden /> {slackLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn(swatch, 'bg-muted-foreground/30')} aria-hidden /> {doneLabel}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={cn(swatch, 'border border-dashed border-muted-foreground/60')} aria-hidden /> {unestimatedLabel}
      </span>
    </div>
  );
}
