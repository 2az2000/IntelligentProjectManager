'use client';

import { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  CalendarClock,
  Check,
  GitBranch,
  Loader2,
  TriangleAlert,
  Waypoints,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { useErrorMessage } from '@/hooks/use-error-message';
import { UserAvatar } from '@/components/shared/user-avatar';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
// Deep imports keep the scheduling → projects/tasks graph acyclic (the header imports our barrel).
import { useProject, useProjectMembers, useTeamWorkload } from '@/features/projects/hooks/use-projects';
import { hasRole } from '@/features/projects/types';
import { useProjectSocket } from '@/features/realtime';
import {
  useApplySchedule,
  useBaselineVariance,
  useBaselines,
  useCreateBaseline,
  useDependencies,
  useSchedule,
} from '../hooks/use-schedule';
import { DeadlinePlanner } from './deadline-planner';
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

  // §2.2 — the newest snapshot is what "the plan" means until the user picks another one.
  const { data: baselines = [] } = useBaselines(projectId);
  const [pickedBaselineId, setPickedBaselineId] = useState<number | null>(null);
  const baselineId = pickedBaselineId ?? baselines[0]?.id ?? null;
  const { data: variance } = useBaselineVariance(projectId, baselineId);
  const createBaseline = useCreateBaseline(projectId);

  // Timeline bars refresh live while teammates move tasks around.
  useProjectSocket(projectId);

  const canApply = hasRole(project?.myRole ?? 'VIEWER', 'MEMBER');

  const layout = useMemo(() => (schedule ? buildTimelineLayout(schedule.tasks) : null), [schedule]);
  const arrows = useMemo(
    () => (layout && schedule ? buildDependencyArrows(layout, dependencies) : []),
    [layout, schedule, dependencies],
  );
  /** Baseline bars share the current axis, so a slip shows as the grey bar falling behind. */
  const ghosts = useMemo(() => {
    const map = new Map<number, { leftPct: number; widthPct: number }>();
    if (!layout || !variance) return map;
    for (const change of variance.tasks) {
      if (change.baselineStartHours === null || change.baselineFinishHours === null) continue;
      const leftPct = Math.min(100, (change.baselineStartHours / layout.totalHours) * 100);
      const widthPct = Math.max(
        0,
        Math.min(
          100 - leftPct,
          ((change.baselineFinishHours - change.baselineStartHours) / layout.totalHours) * 100,
        ),
      );
      map.set(change.taskId, { leftPct, widthPct });
    }
    return map;
  }, [layout, variance]);

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

  const saveBaseline = () =>
    createBaseline.mutate(
      t('baseline.defaultName', { count: formatNumber(baselines.length + 1, locale) }),
      {
        onSuccess: (baseline) => {
          setPickedBaselineId(baseline.id);
          toast.success(t('baseline.saved'));
        },
        onError: (err) => toast.error(toMessage(err)),
      },
    );

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
        <div className="flex flex-wrap items-center gap-2">
          {baselines.length > 0 && baselineId !== null && (
            <Select
              value={String(baselineId)}
              onValueChange={(value) => setPickedBaselineId(Number(value))}
            >
              <SelectTrigger size="sm" className="w-44" aria-label={t('baseline.pick')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {baselines.map((baseline) => (
                  <SelectItem key={baseline.id} value={String(baseline.id)}>
                    {baseline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canApply && (
            <Button
              size="sm"
              variant="outline"
              onClick={saveBaseline}
              disabled={createBaseline.isPending}
            >
              {createBaseline.isPending ? (
                <Loader2 className="me-2 size-4 animate-spin" aria-hidden />
              ) : (
                <BookmarkPlus className="me-2 size-4" aria-hidden />
              )}
              {t('baseline.save')}
            </Button>
          )}
          {canApply && (
            <Button size="sm" onClick={applySchedule} disabled={apply.isPending}>
              {apply.isPending && <Loader2 className="me-2 size-4 animate-spin" aria-hidden />}
              {t('apply')}
            </Button>
          )}
        </div>
      </div>

      {variance && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={variance.durationDriftHours > 0 ? 'destructive' : 'outline'}>
            {t('baseline.durationDrift', {
              hours: formatNumber(variance.durationDriftHours, locale),
            })}
          </Badge>
          <span className="text-muted-foreground">
            {t('baseline.counts', {
              moved: formatNumber(variance.counts.moved, locale),
              added: formatNumber(variance.counts.added, locale),
              removed: formatNumber(variance.counts.removed, locale),
            })}
          </span>
          {variance.counts.moved > 0 && (
            <span className="text-muted-foreground">
              {t('baseline.slip', { hours: formatNumber(variance.totalDriftHours, locale) })}
            </span>
          )}
        </div>
      )}

      {unestimatedCount > 0 && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {t('unestimated', { count: formatNumber(unestimatedCount, locale) })}
        </div>
      )}

      <OverloadStrip projectId={projectId} />

      <DeadlinePlanner projectId={projectId} defaultDeadline={project?.endDate ?? null} />

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
                <Bar key={row.task.id} row={row} ghost={ghosts.get(row.task.id)} />
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

      <Legend
        criticalLabel={t('legend.critical')}
        slackLabel={t('legend.slack')}
        doneLabel={t('legend.done')}
        unestimatedLabel={t('legend.unestimated')}
        baselineLabel={t('baseline.legend')}
        showBaseline={ghosts.size > 0}
      />
    </div>
  );
}

function Bar({
  row,
  ghost,
}: {
  row: TimelineRow;
  /** Where this task sat when the baseline was captured (§2.2); absent without a snapshot. */
  ghost?: { leftPct: number; widthPct: number };
}) {
  const t = useTranslations('Scheduling');
  const { task } = row;

  const label = t('barLabel', {
    title: task.title,
    estimate: task.estimateHours ?? 0,
    slack: task.slack ?? 0,
  });

  return (
    <div style={{ height: ROW_HEIGHT }} className="relative px-2">
      {ghost && (
        <div
          aria-hidden
          title={t('baseline.ghost', { title: task.title })}
          style={{ left: `${ghost.leftPct}%`, width: `${ghost.widthPct}%` }}
          className="absolute top-1 h-1 rounded-full bg-muted-foreground/40"
        />
      )}
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

/**
 * §Imp #4: avatars of the project's members, flagged when they are over-allocated this week
 * (≥110% of weekly capacity in the /me/team/workload heat cells).
 */
function OverloadStrip({ projectId }: { projectId: number }) {
  const t = useTranslations('Scheduling');
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: workload } = useTeamWorkload();

  // The heat query spans the user's whole team; this strip only shows this project's members.
  const byUser = new Map((workload?.members ?? []).map((m) => [m.user.id, m]));
  const rows = members.map((m) => {
    const entry = byUser.get(m.user.id);
    const capacity = entry?.capacityHoursPerWeek ?? workload?.capacityHoursPerWeek ?? 0;
    const hours = entry?.cells[0]?.hours ?? 0;
    return { user: m.user, overloaded: capacity > 0 && hours >= 1.1 * capacity };
  });
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {rows.map(({ user, overloaded }) => (
        <div key={user.id} className="flex items-center gap-1.5">
          <div className="relative">
            <UserAvatar user={user} className="size-7" />
            {overloaded && (
              <span
                title={t('overloadBadge')}
                aria-label={t('overloadBadge')}
                className="absolute -top-1.5 -end-1.5 rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white"
              >
                ··
              </span>
            )}
          </div>
          <span className={cn('max-w-32 truncate text-xs text-muted-foreground', overloaded && 'font-semibold text-red-600 dark:text-red-400')}>
            {user.name}
          </span>
        </div>
      ))}
    </div>
  );
}

function Legend({
  criticalLabel,
  slackLabel,
  doneLabel,
  unestimatedLabel,
  baselineLabel,
  showBaseline,
}: Record<'criticalLabel' | 'slackLabel' | 'doneLabel' | 'unestimatedLabel' | 'baselineLabel', string> & {
  showBaseline: boolean;
}) {
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
      {showBaseline && (
        <span className="flex items-center gap-1.5">
          <span className={cn(swatch, 'h-1 self-center rounded-full bg-muted-foreground/40')} aria-hidden />{' '}
          {baselineLabel}
        </span>
      )}
    </div>
  );
}
