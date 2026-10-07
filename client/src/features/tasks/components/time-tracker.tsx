'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2, Play, Square } from 'lucide-react';
import { useLocale as useTLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useErrorMessage } from '@/hooks/use-error-message';
import { formatNumber } from '@/lib/format';
import {
  useManualTime,
  useOpenTimer,
  useStartTimer,
  useStopTimer,
  useTaskTime,
  type OpenTimer,
  type TimeEntry,
} from '../hooks/use-time-tracking';

/** §6 time tracking row — a stopwatch per task plus a manual fallback. */
export function TimeTracker({ taskId }: { taskId: number }) {
  const t = useTranslations('Time');
  const locale = useTLocale();
  const toMessage = useErrorMessage();
  const { data: open } = useOpenTimer();
  const { data: entries = [] } = useTaskTime(taskId);
  const start = useStartTimer();
  const stop = useStopTimer();
  const manual = useManualTime();
  const [minutes, setMinutes] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const runningHere = open?.taskId === taskId;
  const isRunning = runningHere === true;
  const runningElsewhere = open != null && !runningHere;

  // Tick the running stopwatch once a minute (server remains the source of truth).
  useEffect(() => {
    if (open === null || open === undefined || !runningHere) return;
    const timerOpen: OpenTimer = open;
    const startedAt = new Date(timerOpen.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 60000));
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [isRunning, runningHere, open]);

  const busy = start.isPending || stop.isPending || manual.isPending;

  const onStart = () =>
    start.mutate(taskId, { onError: (error) => toast.error(toMessage(error)) });
  const onStop = () =>
    stop.mutate(taskId, {
      onSuccess: (entry) => {
        if (entry) toast.success(`${t('saved')}: ${formatNumber(entry.minutes, locale)} ${t('manualMinutes')}`);
      },
      onError: (error) => toast.error(toMessage(error)),
    });

  const submitManual = () => {
    const value = Math.round(Number(minutes));
    if (!Number.isFinite(value) || value <= 0 || value > 1440) return;
    manual.mutate(
      { taskId, startedAt: new Date().toISOString(), minutes: value },
      {
        onSuccess: () => {
          setMinutes('');
          toast.success(t('saved'));
        },
        onError: (error) => toast.error(toMessage(error)),
      },
    );
  };

  const totalMinutes = entries.reduce((acc, e: TimeEntry) => acc + e.minutes, 0);

  return (
    <section aria-label={t('entries')} className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Clock aria-hidden className="text-muted-foreground size-4" />
        <span className="text-sm font-medium">{t('entries')}</span>
        <span className="text-muted-foreground ms-auto text-sm" dir="ltr">
          {formatNumber(Math.floor(totalMinutes / 60), locale)}h {formatNumber(totalMinutes % 60, locale)}m
        </span>
        {isRunning ? (
          <Button size="sm" variant="destructive" onClick={onStop} disabled={busy}>
            {stop.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Square aria-hidden className="size-4" />}
            {t('stop')}
            <span className="tabular-nums" dir="ltr">
              {' '}
              {formatNumber(elapsed, locale)}m
            </span>
          </Button>
        ) : (
          <Button size="sm" onClick={onStart} disabled={busy}>
            {start.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Play aria-hidden className="size-4" />}
            {t('start')}
          </Button>
        )}
      </div>
      {runningElsewhere && (
        <p className="text-amber-600 text-xs" role="status">
          {t('running')}: {open?.taskTitle}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Input
          aria-label={t('manual')}
          type="number"
          min={1}
          max={1440}
          placeholder={t('manualMinutes')}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitManual()}
          className="h-8 w-28"
        />
        <Button size="sm" variant="outline" onClick={submitManual} disabled={busy || minutes === ''}>
          {t('manual')}
        </Button>
      </div>
    </section>
  );
}
