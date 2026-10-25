'use client';

import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Info,
  KanbanSquare,
  List,
  Settings,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { Link, usePathname } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
// Via the barrel is safe: scheduling never imports the projects barrel (only deep paths).
import { PredictedFinishBadge } from '@/features/scheduling';
import { useProject } from '../hooks/use-projects';

const TABS = [
  { key: 'board', icon: KanbanSquare },
  { key: 'list', icon: List },
  { key: 'timeline', icon: CalendarRange },
  { key: 'reports', icon: BarChart3 },
  { key: 'settings', icon: Settings },
] as const;

export function ProjectHeader({ projectId }: { projectId: number }) {
  const t = useTranslations('Projects');
  const locale = useLocale();
  const pathname = usePathname();
  const { data: project, isPending, isError, error, refetch } = useProject(projectId);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 lg:flex-1">
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h1>
              <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-0.5 text-[11px] leading-5 font-medium text-violet-600 dark:border-violet-400/20 dark:bg-violet-400/10 dark:text-violet-300">
                {t('versionBadge')}
              </span>
            </div>

            <PredictedFinishBadge projectId={projectId} />

            <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {project.description && (
                <span className="inline-flex items-center gap-1.5">
                  <Info className="size-3.5 shrink-0" aria-hidden />
                  <span dir="auto">{project.description}</span>
                </span>
              )}
              {project.description && (project.startDate || project.endDate) && (
                <span aria-hidden className="text-border">
                  ·
                </span>
              )}
              {(project.startDate || project.endDate) && (
                <span className="inline-flex items-center gap-1.5 text-xs">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                  <span dir="auto">
                    {project.startDate ? formatDate(project.startDate, locale) : '—'}
                    {' – '}
                    {project.endDate ? formatDate(project.endDate, locale) : '—'}
                  </span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <nav
          className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-border/60 bg-muted/40 p-1"
          aria-label={t('views')}
        >
          {TABS.map(({ key, icon: Icon }) => {
            const href = `/app/projects/${projectId}/${key}`;
            const active = pathname === href;
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-[#6c5ce7] font-medium text-white shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(`tabs.${key}`)}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
