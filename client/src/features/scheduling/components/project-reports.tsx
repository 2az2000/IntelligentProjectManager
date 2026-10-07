'use client';

import { useState } from 'react';
import { Activity, BarChart3, CircleDollarSign, Download, ShieldAlert, TrendingDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useBurndown, useForecast, useRisks } from '../hooks/use-analytics';
import { useCost } from '../hooks/use-cost';
import type { ForecastResult, RiskResult } from '../analytics-types';

type Tab = 'forecast' | 'risks' | 'burndown' | 'cost';

const TABS: { id: Tab; icon: typeof BarChart3 }[] = [
  { id: 'forecast', icon: Activity },
  { id: 'risks', icon: ShieldAlert },
  { id: 'burndown', icon: TrendingDown },
  { id: 'cost', icon: CircleDollarSign },
];

/** §6 reports tab — burndown + forecast + risks (+ cost) in one place. */
export function ProjectReports({ projectId }: { projectId: number }) {
  const t = useTranslations('Reports');
  const [tab, setTab] = useState<Tab>('forecast');

  return (
    <section aria-label={t('title')} className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          {/* Same-origin API proxy: the dev server forwards /api to the backend. */}
          <a href={`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/projects/${projectId}/tasks/export.csv`}>
            <Download aria-hidden className="size-4" />
            {t('exportCsv')}
          </a>
        </Button>
      </header>

      <div role="tablist" aria-label={t('title')} className="flex flex-wrap gap-2">
        {TABS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors',
              tab === id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'hover:bg-muted text-muted-foreground',
            )}
          >
            <Icon aria-hidden className="size-4" />
            {t(`tabs.${id}`)}
          </button>
        ))}
      </div>

      {tab === 'forecast' && <ForecastPanel projectId={projectId} />}
      {tab === 'risks' && <RisksPanel projectId={projectId} />}
      {tab === 'burndown' && <BurndownPanel projectId={projectId} />}
      {tab === 'cost' && <CostPanel projectId={projectId} />}
    </section>
  );
}

function ForecastPanel({ projectId }: { projectId: number }) {
  const locale = useLocale();
  const { data, isPending, isError, error, refetch } = useForecast(projectId);
  if (isPending)
    return (
      <div className="grid gap-3 sm:grid-cols-3" aria-busy>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;
  return <ForecastView data={data} runs={data.runs} locale={locale} />;
}

function ForecastView({
  data,
  runs,
  locale,
}: {
  data: Omit<ForecastResult, 'tasks'>;
  runs: number;
  locale: string;
}) {
  const t = useTranslations('Reports');
  const rows = [
    { label: t('forecast.p50'), hours: data.p50Hours, date: data.p50Date, accent: 'bg-emerald-500' },
    { label: t('forecast.p85'), hours: data.p85Hours, date: data.p85Date, accent: 'bg-amber-500' },
    { label: t('forecast.p95'), hours: data.p95Hours, date: data.p95Date, accent: 'bg-rose-500' },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span aria-hidden className={cn('h-2.5 w-2.5 rounded-full', r.accent)} />
              <span className="text-muted-foreground text-sm">{r.label}</span>
            </div>
            <p className="mt-1 text-2xl font-semibold" dir="ltr">
              {formatDate(r.date, locale)}
            </p>
            <p className="text-muted-foreground text-xs" dir="ltr">
              {formatNumber(Math.round(r.hours), locale)}h
            </p>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground flex items-center gap-2 text-xs">
        <Badge variant="secondary">{formatNumber(runs, locale)} {t('forecast.runs')}</Badge>
        {t('forecast.explain')}
      </p>
      <p className="text-sm">
        {data.deadlineProbability === null ? (
          <span className="text-muted-foreground">{t('forecast.noDeadline')}</span>
        ) : (
          <>
            <span className="text-muted-foreground">{t('forecast.deadlineProb')}: </span>
            <span
              className={cn(
                'font-semibold',
                data.deadlineProbability >= 0.8
                  ? 'text-emerald-600'
                  : data.deadlineProbability >= 0.5
                    ? 'text-amber-600'
                    : 'text-rose-600',
              )}
              dir="ltr"
            >
              {Math.round(data.deadlineProbability * 100)}%
            </span>
          </>
        )}
      </p>
    </div>
  );
}

function RisksPanel({ projectId }: { projectId: number }) {
  const t = useTranslations('Reports');
  const { data, isPending, isError, error, refetch } = useRisks(projectId);
  if (isPending) return <Skeleton className="h-40" aria-busy />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  const active = (data as RiskResult | undefined)?.tasks.filter((r) => r.score > 0) ?? [];
  if (active.length === 0) return <EmptyState icon={ShieldAlert} title={t('risks.empty')} />;
  return (
    <ul className="flex flex-col gap-2">
      {active.map((r) => (
        <li key={r.taskId} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <span
            aria-hidden
            className={cn(
              'size-2.5 shrink-0 rounded-full',
              r.score >= 60 ? 'bg-rose-500' : r.score >= 35 ? 'bg-amber-500' : 'bg-emerald-500',
            )}
          />
          <span className="font-medium">{r.title}</span>
          <span className="text-muted-foreground ms-auto text-xs" dir="ltr">
            {t('risks.score')} {r.score}
          </span>
          <div className="flex flex-wrap gap-1">
            {r.reasons.map((reason) => (
              <Badge key={reason} variant="outline" className="text-[11px]">
                {t(`risks.reasons.${reason}`)}
              </Badge>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function BurndownPanel({ projectId }: { projectId: number }) {
  const t = useTranslations('Reports');
  const locale = useLocale();
  const { data, isPending, isError, error, refetch } = useBurndown(projectId);
  if (isPending) return <Skeleton className="h-52" aria-busy />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data || data.points.length < 2) return <EmptyState icon={TrendingDown} title={t('burndown.total')} />;
  const points = data.points;
  const w = 560;
  const h = 180;
  const max = Math.max(1, data.total);
  const x = (i: number) => (i / (points.length - 1)) * (w - 40) + 30;
  const y = (v: number) => h - 24 - (v / max) * (h - 44);
  const line = (key: 'remaining' | 'ideal') =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-muted-foreground flex gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span aria-hidden className="bg-primary inline-block h-0.5 w-4" /> {t('burndown.remaining')}
        </span>
        <span className="flex items-center gap-1">
          <span aria-hidden className="inline-block h-0.5 w-4 border-t-2 border-dashed border-neutral-400" /> {t('burndown.ideal')}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t('title')} className="w-full max-w-2xl">
        <path d={line('ideal')} fill="none" stroke="currentColor" strokeDasharray="4 4" className="text-neutral-400" strokeWidth="1.5" />
        <path d={line('remaining')} fill="none" stroke="currentColor" className="text-primary" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.remaining)} r="2.5" className="fill-primary" />
        ))}
      </svg>
      <p className="text-muted-foreground text-xs" dir="ltr">
        {formatNumber(data.total, locale)} {t('burndown.total')} · {formatDate(points[0]!.date, locale)} → {formatDate(points[points.length - 1]!.date, locale)}
      </p>
    </figure>
  );
}

export interface CostSummary {
  bookedCost: number;
  trackedMinutes: number;
  unpricedMinutes: number;
  budget: number | null;
  hourlyRate: number | null;
  perMember: { userId: number; name: string; minutes: number; hourlyRate: number | null; cost: number | null }[];
}

function CostPanel({ projectId }: { projectId: number }) {
  const t = useTranslations('Reports');
  const locale = useLocale();
  const { data, isPending, isError, error, refetch } = useCost(projectId);
  if (isPending) return <Skeleton className="h-40" aria-busy />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!data) return null;
  const budgetPct = data.budget && data.budget > 0 ? Math.min(100, (data.bookedCost / data.budget) * 100) : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">{t('cost.booked')}</p>
          <p className="mt-1 text-2xl font-semibold" dir="ltr">
            {formatNumber(Math.round(data.bookedCost), locale)}
          </p>
          {data.hourlyRate !== null && (
            <p className="text-muted-foreground text-xs" dir="ltr">
              {t('cost.rate')}: {formatNumber(data.hourlyRate, locale)}
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">{t('cost.tracked')}</p>
          <p className="mt-1 text-2xl font-semibold" dir="ltr">
            {formatNumber(Math.round(data.trackedMinutes / 60), locale)}h
          </p>
          {data.unpricedMinutes > 0 && (
            <p className="text-amber-600 text-xs">{t('cost.unpriced')}: {formatNumber(Math.round(data.unpricedMinutes / 60), locale)}h</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-muted-foreground text-sm">{t('cost.budget')}</p>
          {data.budget === null ? (
            <p className="text-muted-foreground mt-1 text-sm">{t('cost.noRate')}</p>
          ) : (
            <>
              <p className="mt-1 text-2xl font-semibold" dir="ltr">
                {formatNumber(data.budget, locale)}
              </p>
              {budgetPct !== null && <Progress aria-label={t('cost.budget')} value={budgetPct} className="mt-2 h-2" />}
            </>
          )}
        </div>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-muted-foreground mb-2 text-sm">{t('cost.perMember')}</p>
        <ul className="flex flex-col divide-y">
          {data.perMember.map((m) => (
            <li key={m.userId} className="flex items-center justify-between py-1.5 text-sm">
              <span>{m.name}</span>
              <span className="text-muted-foreground" dir="ltr">
                {formatNumber(Math.round(m.minutes / 60), locale)}h
                {m.cost !== null && ` · ${formatNumber(Math.round(m.cost), locale)}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
