'use client';

import { CalendarClock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
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
    <Badge variant="secondary" className="gap-1">
      <CalendarClock className="size-3.5" aria-hidden />
      {t('predictedFinish', { date: formatDate(predicted, locale) })}
    </Badge>
  );
}
