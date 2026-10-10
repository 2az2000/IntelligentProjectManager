'use client';

import { AlarmClock, CalendarClock, Inbox } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/shared/error-state';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { useTaskSheet } from '@/features/tasks/hooks/use-task-sheet';
import { formatDate, formatNumber } from '@/lib/format';
import { useDigest } from '../hooks/use-dashboard';
import { dashboardApi } from '../api/dashboard.api';

/**
 * §5 daily digest report: opened from the DAILY_DIGEST notification (bell item or its toast).
 * The fresh report comes from GET /dashboard/digest while the modal is open; if it was
 * already delivered by the 08:00 email, the dialog also shows the latest delivered snapshot
 * ("as seen in your mail") so the user can compare today's reality against the email.
 */
export function DigestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('Notifications');
  const locale = useLocale();
  const { openTask } = useTaskSheet();
  const fresh = useDigest(open);

  const snapshot = fresh.data?.overdueByDays ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('digest.title')}</DialogTitle>
          <DialogDescription>{t('digest.subtitle')}</DialogDescription>
        </DialogHeader>

        {fresh.isPending ? (
          <TableSkeleton rows={3} />
        ) : fresh.isError ? (
          <ErrorState error={fresh.error} onRetry={() => fresh.refetch()} />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2">
              {snapshot > 0 && (
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <Inbox className="size-3.5" aria-hidden />
                    {t('digest.snapshot')}
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
                    {snapshot}
                  </p>
                </div>
              ))
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <Inbox className="size-3.5" aria-hidden />
                  {t('digest.open')}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatNumber(fresh.data?.open ?? 0, locale)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <AlarmClock className="size-3.5" aria-hidden />
                  {t('digest.overdue')}
                </p>
                <p
                  className={`mt-1 text-2xl font-semibold tabular-nums ${
                    (fresh.data?.overdue ?? 0) > 0 ? 'text-destructive' : ''
                  }`}
                >
                  {formatNumber(fresh.data?.overdue ?? 0, locale)}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                  <CalendarClock className="size-3.5" aria-hidden />
                  {t('digest.dueToday')}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatNumber(fresh.data?.dueToday ?? 0, locale)}
                </p>
              </div>
            </div>

            {fresh.data.tasks.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('digest.empty')}</p>
            ) : (
              <ul className="divide-y rounded-md border" role="list">
                {fresh.data.tasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      className="hover:bg-muted/60 flex w-full items-start justify-between gap-3 px-3 py-2 text-start"
                      onClick={() => {
                        onOpenChange(false);
                        openTask(task.id);
                      }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{task.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {task.dueDate
                            ? `${task.projectName} · ${formatDate(task.dueDate, locale)}${t('digest.overdue').startsWith('عقب') ? ' · ' : ' · '}`
                            : task.projectName}
                        </span>
                      </span>
                      {task.overdue && (
                        <Badge variant="destructive">
                          {locale === 'fa'
                            ? t('digest.overdue', { n: task.overdueByDays })
                            : t('digest.overdue', { n: task.overdueByDays })}
                        </Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
