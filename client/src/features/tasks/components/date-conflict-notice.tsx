'use client';

import { TriangleAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { TaskDateConflict } from '../types';

/**
 * §4 Productivity — advisory banner after a manual date edit contradicts a dependency.
 *
 * The write already succeeded (the server answers with warnings instead of an error), so this
 * never blocks: it names the clash in plain language and offers the other task, so the date or
 * the dependency itself can be fixed. Dismissing is safe — the next date edit re-checks.
 */
export function DateConflictNotice({
  conflicts,
  onOpenTask,
  onDismiss,
}: {
  conflicts: TaskDateConflict[];
  onOpenTask: (taskId: number) => void;
  onDismiss: () => void;
}) {
  const t = useTranslations('Tasks');
  if (conflicts.length === 0) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">{t('dateConflictTitle')}</p>
        <ul className="flex flex-col gap-1 text-muted-foreground">
          {conflicts.map((conflict) => (
            <li
              key={`${conflict.direction}-${conflict.relatedTaskId}`}
              className="flex flex-wrap items-center gap-x-1.5 gap-y-1"
            >
              <span>
                {t(
                  conflict.direction === 'predecessor'
                    ? 'dateConflictPredecessor'
                    : 'dateConflictSuccessor',
                  { title: conflict.relatedTaskTitle, days: conflict.conflictDays },
                )}
              </span>
              <button
                type="button"
                onClick={() => onOpenTask(conflict.relatedTaskId)}
                className="text-foreground font-medium underline-offset-4 hover:underline"
              >
                {t('dateConflictOpen')}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground text-xs">{t('dateConflictHint')}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-me-1 -mt-1 size-7 shrink-0"
        onClick={onDismiss}
        aria-label={t('dateConflictDismiss')}
      >
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
