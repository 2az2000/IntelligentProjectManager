'use client';

import { Fragment } from 'react';
import { ArrowLeftRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { formatDate, formatRelative } from '@/lib/format';
import { useActivity } from '../hooks/use-activity';
import { ACTIVITY_ACTIONS, type ActivityAction, type ActivityEntry } from '../types';

const ACTION_ICON: Record<ActivityAction, typeof Pencil> = {
  created: Plus,
  updated: Pencil,
  moved: ArrowLeftRight,
  deleted: Trash2,
};

/** Human-readable value for a tracked field change, honoring enum/date fields. */
function useValueFormatter() {
  const t = useTranslations('Tasks');
  const locale = useLocale();
  const tActivity = useTranslations('Activity');

  return (field: string, value: string | null): string => {
    if (value === null) return tActivity('emptyValue');
    if (field === 'status' && t.has(`status.${value}`)) return t(`status.${value}`);
    if (field === 'priority' && t.has(`priority.${value}`)) return t(`priority.${value}`);
    if (field === 'startDate' || field === 'dueDate') return formatDate(value, locale);
    return value;
  };
}

function EntryLine({ entry, resolveUser }: { entry: ActivityEntry; resolveUser?: (id: string) => string | null }) {
  const t = useTranslations('Activity');
  const locale = useLocale();
  const formatValue = useValueFormatter();
  const Icon = ACTION_ICON[entry.action] ?? Pencil;

  const name = (id: string): string => resolveUser?.(id) ?? `#${id}`;
  const describe = (field: string | null, value: string | null): string => {
    if (field === null) return '';
    if (field === 'assigneeId') return value === null ? t('unassigned') : name(value);
    return formatValue(field, value);
  };

  return (
    <li className="flex gap-2">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-5">
          <span className="font-medium">{entry.actor.name}</span>{' '}
          {t(`actions.${entry.action}`)}
          {entry.field && (
            <>
              {' · '}
              <span className="text-muted-foreground">{t(`fields.${entry.field}`)}</span>
              {entry.action !== 'deleted' && entry.field !== 'title' && (
                <>
                  {': '}
                  <s className="text-muted-foreground">{describe(entry.field, entry.oldValue)}</s>
                  {' → '}
                  <span>{describe(entry.field, entry.newValue)}</span>
                </>
              )}
            </>
          )}
        </p>
        <p className="text-[10px] text-muted-foreground">{formatRelative(entry.createdAt, locale)}</p>
      </div>
    </li>
  );
}

/** Chronological audit trail of a task: created/updated/moved/deleted with field diffs. */
export function ActivityTimeline({
  taskId,
  resolveUser,
}: {
  taskId: number;
  /** Maps an assigneeId value to a display name (e.g. from the member list). */
  resolveUser?: (id: string) => string | null;
}) {
  const t = useTranslations('Activity');
  const { data: entries, isPending } = useActivity(taskId);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{t('title')}</h3>
      {isPending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {entries.map((entry) => (
            <Fragment key={entry.id}>
              <EntryLine entry={entry} resolveUser={resolveUser} />
            </Fragment>
          ))}
        </ol>
      )}
    </section>
  );
}

export { ACTIVITY_ACTIONS };
