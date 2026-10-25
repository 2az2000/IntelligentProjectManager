'use client';

import { Clock3 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate } from '@/lib/format';
import { useSchedule } from '../hooks/use-schedule';
import { predictedFinish } from '../lib/timeline';

/** Roadmap: the project's predicted finish date in the header. Hidden while nothing is estimated. */
export function PredictedFinishBadge({ projectId }: { projectId: number }) {
  const t = useTranslations('Scheduling');
  const locale = useLocale();
  const { data: schedule } = useSchedule(projectId);

  if (!schedule || schedule.projectDurationHours <= 0) return null;
  const predicted = predictedFinish(schedule, new Date());

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-500 dark:text-rose-400">
      <Clock3 className="size-3.5 shrink-0" aria-hidden />
      {t('predictedFinish', { date: formatDate(predicted, locale) })}
    </span>
  );
}
