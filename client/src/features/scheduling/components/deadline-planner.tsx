'use client';

import { useState } from 'react';
import { CalendarClock, CircleCheck, CircleX, Loader2, Rocket } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/shared/date-picker';
import { ErrorState } from '@/components/shared/error-state';
import { formatDate, formatNumber } from '@/lib/format';
import { toDayIso } from '@/lib/calendar';
import type { PlanConfidence } from '../analytics-types';
import { usePlan } from '../hooks/use-analytics';

const CONFIDENCES: PlanConfidence[] = [50, 85, 95];

/**
 * §3 deadline planner: "the client needs it on the 25th — what must start today?".
 * The server shifts the CPM schedule by the Monte Carlo buffer; this card only presents it.
 */
export function DeadlinePlanner({ projectId, defaultDeadline }: { projectId: number; defaultDeadline?: string | null }) {
  const t = useTranslations('Scheduling');
  const locale = useLocale();
  const [picked, setPicked] = useState<Date | null>(null);
  const [confidence, setConfidence] = useState<PlanConfidence>(85);
  const [target, setTarget] = useState<{ by: string; confidence: PlanConfidence } | null>(null);
  // The project may load after this card mounts; the project's own endDate is the default until
  // the user picks something else (no effect, so no extra render and no lint exception).
  const deadline = picked ?? (defaultDeadline ? new Date(defaultDeadline) : null);

  const plan = usePlan(projectId, target);
  const data = plan.data;
  const startNow = data?.tasks.filter((task) => task.mustStartNow) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" aria-hidden />
          {t('plannerTitle')}
        </CardTitle>
        <CardDescription>{t('plannerDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-col gap-1">
            <span className="text-xs font-medium">{t('plannerDeadline')}</span>
            <DatePicker value={deadline} onChange={setPicked} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t('plannerConfidence')}</span>
            <Select
              value={String(confidence)}
              onValueChange={(value) => setConfidence(Number(value) as PlanConfidence)}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONFIDENCES.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {t('plannerConfidenceValue', { value })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            className="gap-2"
            disabled={!deadline || plan.isFetching}
            onClick={() =>
              deadline &&
              setTarget({ by: toDayIso(deadline), confidence })
            }
          >
            {plan.isFetching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CalendarClock className="size-4" aria-hidden />}
            {t('plannerCalculate')}
          </Button>
        </div>

        {!deadline && <p className="text-muted-foreground text-sm">{t('plannerNeedDate')}</p>}

        {plan.isError && <ErrorState error={plan.error} onRetry={() => plan.refetch()} />}

        {data && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={data.feasible ? 'secondary' : 'destructive'} className="gap-1">
                {data.feasible ? <CircleCheck className="size-3.5" aria-hidden /> : <CircleX className="size-3.5" aria-hidden />}
                {data.feasible ? t('plannerFeasible') : t('plannerInfeasible')}
              </Badge>
              <Badge variant="outline">
                {t('plannerBuffer', { days: formatNumber(data.bufferWorkingDays, locale) })}
              </Badge>
              <Badge variant="outline">
                {t('plannerAvailable', { hours: formatNumber(data.availableHours, locale) })}
              </Badge>
              <Badge variant="outline">
                {t('plannerRequired', { hours: formatNumber(Math.round(data.requiredHours), locale) })}
              </Badge>
            </div>

            {!data.feasible && <p className="text-sm text-destructive">{t('plannerInfeasibleHint')}</p>}

            {startNow.length > 0 ? (
              <div className="rounded-lg border border-destructive/40 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Rocket className="size-4" aria-hidden />
                  {t('plannerStartNow', { count: startNow.length })}
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {startNow.slice(0, 6).map((task) => (
                    <li key={task.taskId} className="flex flex-wrap items-center justify-between gap-1">
                      <span className="line-clamp-1">{task.title}</span>
                      <span className="text-muted-foreground text-xs">
                        {task.latestStart ? t('plannerShouldHaveStarted', { date: formatDate(task.latestStart, locale) }) : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t('plannerNothingUrgent')}</p>
            )}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="p-2 text-start font-medium">{t('plannerTask')}</th>
                    <th className="p-2 text-start font-medium">{t('plannerLatestStart')}</th>
                    <th className="p-2 text-start font-medium">{t('plannerLatestFinish')}</th>
                    <th className="p-2 text-start font-medium">{t('plannerSlack')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tasks.map((task) => (
                    <tr key={task.taskId} className="border-t">
                      <td className="max-w-64 truncate p-2">{task.title}</td>
                      <td className="p-2 text-xs">{task.latestStart ? formatDate(task.latestStart, locale) : '—'}</td>
                      <td className="p-2 text-xs">{task.latestFinish ? formatDate(task.latestFinish, locale) : '—'}</td>
                      <td className="p-2 text-xs">
                        {task.slackHours === null ? '—' : t('plannerHours', { hours: Math.round(task.slackHours) })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.unestimatedTaskIds.length > 0 && (
              <p className="text-muted-foreground text-xs">
                {t('plannerUnestimated', { count: data.unestimatedTaskIds.length })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
