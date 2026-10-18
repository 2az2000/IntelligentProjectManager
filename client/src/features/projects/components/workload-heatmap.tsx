'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Flame } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { CardGridSkeleton } from '@/components/shared/loading-skeletons';
import { UserAvatar } from '@/components/shared/user-avatar';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useTeamWorkload } from '../hooks/use-projects';
import type { TeamWorkload, TeamWorkloadCell } from '../types';

/**
 * §Imp #4: ratio ≥ 110% burns red, ≥ 80% amber, below is green — capacity is the server's
 * WEEKLY_CAPACITY (or the member's per-project override). Clicking a cell lists the open
 * tasks behind those hours, so reassignment is one conversation away.
 */
function heatClass(hours: number, capacity: number): string {
  const ratio = capacity > 0 ? hours / capacity : 0;
  if (ratio >= 1.1) return 'bg-red-500/85 text-white';
  if (ratio >= 0.8) return 'bg-amber-500/85 text-white';
  return 'bg-emerald-500/75 text-emerald-950';
}

const weekRangeLabel = (start: string, end: string, locale: string) => {
  const fmt = new Intl.DateTimeFormat(
    locale === 'fa' ? 'fa-IR-u-ca-persian' : 'en-US',
    { month: 'short', day: 'numeric' },
  );
  return `${fmt.format(new Date(start))} – ${fmt.format(new Date(end))}`;
};

interface SelectedCell {
  userId: number;
  userName: string;
  weekIndex: number;
  cell: TeamWorkloadCell;
}

export function WorkloadHeatmap({ weeks = 8 }: { weeks?: number }) {
  const t = useTranslations('Members');
  const locale = useLocale();
  const n = (v: number) => formatNumber(v, locale);
  const { data, isPending, isError, error, refetch } = useTeamWorkload(weeks);
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  const capacityOf = (m: TeamWorkload['members'][number]) =>
    m.capacityHoursPerWeek ?? data?.capacityHoursPerWeek ?? 0;

  // Small enough to recompute on every render; a useMemo here tripped the React Compiler.
  const overloaded = data
    ? data.members.filter((m) => m.cells[0] && m.cells[0].hours >= 1.1 * capacityOf(m)).length
    : 0;

  if (isPending) return <CardGridSkeleton count={2} />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (data.members.length === 0) return <EmptyState title={t('empty')} />;

  const capacity = data.capacityHoursPerWeek;
  const weeks_ = data.weeks;
  const select = (m: TeamWorkload['members'][number], weekIndex: number) => {
    const cell = m.cells[weekIndex];
    setSelected(
      cell && cell.tasks.length > 0
        ? { userId: m.user.id, userName: m.user.name, weekIndex, cell }
        : null,
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Flame className="size-4 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <CardTitle>{t('workloadHeatmap')}</CardTitle>
          <CardDescription>
            {t('heatDescription', { capacity: n(capacity) })}
            {overloaded > 0 && ` · ${t('overloadedCount', { count: n(overloaded) })}`}
          </CardDescription>
        </div>
        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex" aria-hidden>
          <span className="size-3 rounded-sm bg-emerald-500/75" /> {t('heatOk')}
          <span className="size-3 rounded-sm bg-amber-500/85" /> {t('heatNear')}
          <span className="size-3 rounded-sm bg-red-500/85" /> {t('heatOver')}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className="overflow-x-auto"
          role="table"
          aria-label={t('workloadHeatmap')}
        >
          <table className="w-full min-w-max border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-card px-2 text-start font-medium text-muted-foreground" />
                {weeks_.map((w, i) => (
                  // Week 0 is current — mark it so "who's saturated right now" is obvious.
                  <th key={w.start} scope="col" className="px-1 pb-1 font-medium text-muted-foreground">
                    {i === 0 ? t('thisWeek') : weekRangeLabel(w.start, w.end, locale)}
                  </th>
                ))}
                <th scope="col" className="px-1 pb-1 font-medium text-muted-foreground">
                  {t('total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => {
                const total = m.cells.reduce((s, c) => s + c.hours, 0);
                return (
                  <tr key={m.user.id}>
                    <th scope="row" className="sticky left-0 z-10 flex items-center gap-2 whitespace-nowrap bg-card p-1 text-start font-normal">
                      <UserAvatar user={m.user} className="size-6" />
                      <span className={cn('max-w-28 truncate', total > 1.1 * capacityOf(m) * weeks_.length && 'font-semibold')}>
                        {m.user.name}
                      </span>
                    </th>
                    {m.cells.map((cell, weekIndex) => {
                      const isSelected =
                        selected?.userId === m.user.id && selected.weekIndex === weekIndex;
                      const empty = cell.tasks.length === 0;
                      return (
                        <td key={weekIndex} className="p-0">
                          <button
                            type="button"
                            onClick={() => select(m, weekIndex)}
                            title={`${n(Math.round(cell.hours))}h · ${t('tasksCount', { count: n(cell.tasks.length) })}`}
                            aria-pressed={isSelected}
                            className={cn(
                              'flex h-8 w-12 items-center justify-center rounded-md font-medium tabular-nums',
                              empty ? 'bg-muted text-muted-foreground' : heatClass(cell.hours, capacityOf(m)),
                              empty && 'cursor-default',
                              isSelected && 'ring-2 ring-primary ring-offset-1 ring-offset-card',
                            )}
                          >
                            {empty ? '' : n(Math.round(cell.hours))}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-1 text-center font-medium tabular-nums text-foreground">
                      {n(Math.round(total))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {selected && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {t('cellDetails', {
                  name: selected.userName,
                  week: weeks_[selected.weekIndex]
                    ? weekRangeLabel(weeks_[selected.weekIndex].start, weeks_[selected.weekIndex].end, locale)
                    : '',
                })}
              </p>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={cn('text-xs text-muted-foreground hover:text-foreground', 'cursor-pointer')}
              >
                {t('close')}
              </button>
            </div>
            <ul className="divide-y text-sm">
              {selected.cell.tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{task.projectName}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {task.estimateHours == null ? '—' : `${n(Math.round(task.estimateHours))}h`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
