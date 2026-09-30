'use client';

import { KanbanSquare, List, Settings } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/shared/error-state';
import { Link, usePathname } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useProject } from '../hooks/use-projects';

const TABS = [
  { key: 'board', icon: KanbanSquare },
  { key: 'list', icon: List },
  { key: 'settings', icon: Settings },
] as const;

export function ProjectHeader({ projectId }: { projectId: number }) {
  const t = useTranslations('Projects');
  const locale = useLocale();
  const pathname = usePathname();
  const { data: project, isPending, isError, error, refetch } = useProject(projectId);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <header className="mb-6 flex flex-col gap-4">
      <div>
        {isPending ? (
          <Skeleton className="h-9 w-64" />
        ) : (
          <>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
              {(project.startDate || project.endDate) && (
                <span className="ms-2">
                  {project.startDate && formatDate(project.startDate, locale)}
                  {' — '}
                  {project.endDate && formatDate(project.endDate, locale)}
                </span>
              )}
            </p>
          </>
        )}
      </div>
      <nav className="flex gap-1 border-b" aria-label={t('views')}>
        {TABS.map(({ key, icon: Icon }) => {
          const href = `/projects/${projectId}/${key}`;
          const active = pathname === href;
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors',
                active
                  ? 'border-primary font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(`tabs.${key}`)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
