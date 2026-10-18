'use client';

import { ArrowLeftRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { UserAvatar } from '@/components/shared/user-avatar';
import { formatDate, formatNumber, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useActivity } from '../hooks/use-activity';
import { ACTIVITY_ACTIONS, type ActivityAction, type ActivityEntry } from '../types';

const ACTION_ICON: Record<ActivityAction, typeof Pencil> = {
  created: Plus,
  updated: Pencil,
  moved: ArrowLeftRight,
  deleted: Trash2,
};

/** Longest value quoted inline before it gets elided (description shows a length instead). */
const MAX_INLINE = 48;

/**
 * Tracked fields whose value is a bare number. Rendered with its unit so "8" reads as
 * "8 hours" rather than as a mystery digit.
 */
const NUMBER_UNITS: Record<string, 'hours' | 'points'> = {
  estimateHours: 'hours',
  points: 'points',
};

/** Human-readable value for a tracked field change, honouring enums, dates and units. */
function useValueFormatter() {
  const t = useTranslations('Tasks');
  const tActivity = useTranslations('Activity');
  const locale = useLocale();

  return (field: string, value: string | null): string => {
    if (value === null || value === '') return tActivity('emptyValue');
    if (field === 'status' && t.has(`status.${value}`)) return t(`status.${value}`);
    if (field === 'priority' && t.has(`priority.${value}`)) return t(`priority.${value}`);
    if (field === 'startDate' || field === 'dueDate') return formatDate(value, locale);
    // A description diff would be a wall of text — the length is the useful part.
    if (field === 'description') return tActivity('textValue', { count: value.length });
    if (field === 'tags') {
      const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
      return tags.length === 0 ? tActivity('emptyValue') : tags.map((tag) => `#${tag}`).join(' ');
    }
    const unit = NUMBER_UNITS[field];
    if (unit) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        return tActivity(`units.${unit}`, { value: formatNumber(numeric, locale) });
      }
    }
    return value.length > MAX_INLINE ? `${value.slice(0, MAX_INLINE)}…` : value;
  };
}

function EntryLine({
  entry,
  resolveUser,
}: {
  entry: ActivityEntry;
  resolveUser?: (id: string) => string | null;
}) {
  const t = useTranslations('Activity');
  const locale = useLocale();
  const formatValue = useValueFormatter();
  const Icon = ACTION_ICON[entry.action] ?? Pencil;

  const name = (id: string): string => resolveUser?.(id) ?? `#${id}`;
  const describe = (field: string, value: string | null): string => {
    if (field === 'assigneeId') return value === null ? t('unassigned') : name(value);
    // Ownership is logged as the whole set: "1, 4" → "سارا احمدی، رضا محمدی".
    if (field === 'assignees') {
      const ids = (value ?? '').split(',').map((id) => id.trim()).filter(Boolean);
      return ids.length === 0 ? t('unassigned') : ids.map(name).join('، ');
    }
    return formatValue(field, value);
  };
  // Renames read as a diff like any other field; only a real "no values" row stays terse.
  const field = entry.field;
  const showDiff = field !== null && entry.action !== 'deleted';

  return (
    <li className="flex gap-2.5">
      <UserAvatar user={entry.actor} className="mt-0.5 size-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs leading-5">
          <span className="font-medium">{entry.actor.name}</span>
          <span className="text-muted-foreground">{t(`actions.${entry.action}`)}</span>
          {field !== null && (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Icon className="size-3" aria-hidden />
              {t(`fields.${field}`)}
            </span>
          )}
        </p>
        {showDiff && field !== null && (
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground line-through decoration-muted-foreground/50">
              {describe(field, entry.oldValue)}
            </span>
            <span className="text-muted-foreground" aria-hidden>
              →
            </span>
            <span className="font-medium">{describe(field, entry.newValue)}</span>
          </p>
        )}
        <p className="text-muted-foreground mt-0.5 text-[10px]" title={formatDate(entry.createdAt, locale)}>
          {formatRelative(entry.createdAt, locale)}
        </p>
      </div>
    </li>
  );
}

/** Local calendar day key so "today" is the user's today, not UTC's. */
const dayKey = (iso: string): string => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/**
 * Audit trail of a task, grouped by day and summarised — who changed it, how often, and what
 * each change did to which field (old → new).
 */
export function ActivityTimeline({
  taskId,
  resolveUser,
}: {
  taskId: number;
  /** Maps an assigneeId value to a display name (e.g. from the member list). */
  resolveUser?: (id: string) => string | null;
}) {
  const t = useTranslations('Activity');
  const locale = useLocale();
  const { data: entries, isPending } = useActivity(taskId);

  const today = dayKey(new Date().toISOString());
  const label = (iso: string): string => {
    const key = dayKey(iso);
    if (key === today) return t('today');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === dayKey(yesterday.toISOString())) return t('yesterday');
    return formatDate(iso, locale, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const groups: { label: string; entries: ActivityEntry[] }[] = [];
  for (const entry of entries ?? []) {
    const current = groups[groups.length - 1];
    if (current && current.label === label(entry.createdAt)) current.entries.push(entry);
    else groups.push({ label: label(entry.createdAt), entries: [entry] });
  }

  const people = new Set((entries ?? []).map((entry) => entry.actor.id)).size;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        {entries && entries.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {t('summary', { changes: entries.length, people })}
          </span>
        )}
      </div>

      {isPending ? (
        <p className="text-muted-foreground text-sm">{t('loading')}</p>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.label} className="flex flex-col gap-2.5">
              <p className={cn('text-muted-foreground text-[10px] font-medium tracking-wide uppercase')}>
                {group.label}
              </p>
              <ol className="flex flex-col gap-2.5 border-s ps-3">
                {group.entries.map((entry) => (
                  <EntryLine key={entry.id} entry={entry} resolveUser={resolveUser} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export { ACTIVITY_ACTIONS };
