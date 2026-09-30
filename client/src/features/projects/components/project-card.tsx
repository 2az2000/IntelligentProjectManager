'use client';

import { AlertTriangle, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Link } from '@/i18n/navigation';
import { formatDate, formatNumber, formatPercent } from '@/lib/format';
import type { Project } from '../types';

export function ProjectCard({ project }: { project: Project }) {
  const t = useTranslations('Projects');
  const tc = useTranslations('Common');
  const locale = useLocale();
  const n = (value: number) => formatNumber(value, locale);
  const { total, done, overdue } = project.stats;
  const ratio = total === 0 ? 0 : done / total;

  return (
    <Link href={`/projects/${project.id}/board`} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card className="h-full transition-shadow duration-200 group-hover:shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg transition-colors group-hover:text-primary">{project.name}</CardTitle>
            <Badge variant="outline" className="shrink-0 text-[10px]">
              {t(`roles.${project.myRole}`)}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2 min-h-10">
            {project.description || tc('noDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('progress')}</span>
              <span>
                {t('doneOfTotal', { done: n(done), total: n(total) })} · {formatPercent(ratio, locale)}
              </span>
            </div>
            <Progress value={ratio * 100} aria-label={t('progress')} />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <UserAvatar user={project.owner} className="size-5" />
                {project.owner.name}
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                {n(project.memberCount)}
              </span>
            </span>
            {overdue > 0 ? (
              <span className="flex items-center gap-1 font-medium text-destructive">
                <AlertTriangle className="size-3.5" aria-hidden />
                {t('overdueCount', { count: n(overdue) })}
              </span>
            ) : (
              project.endDate && <span>{t('dueOn', { date: formatDate(project.endDate, locale) })}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
