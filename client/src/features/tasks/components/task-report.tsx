'use client';

import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  CircleSlash,
  Clock,
  GitBranch,
  Route,
  UserX,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Progress } from '@/components/ui/progress';
import { useTaskSchedule, useDependencies } from '@/features/scheduling';
import { StatusBadge, type ProjectStatus } from '@/features/statuses';
import { formatDate, formatNumber } from '@/lib/format';
import { useTaskTime } from '../hooks/use-time-tracking';
import { isOverdue, type TaskDetail } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Nothing moved in this long and it is still open — worth a nudge, not an alarm. */
const STALE_DAYS = 14;

/** One line of the report's "what needs attention" list. */
interface Signal {
  icon: typeof AlertTriangle;
  label: string;
  tone: 'warn' | 'danger' | 'info';
}

/**
 * The task's own report: planned vs actually booked effort, where it sits in the critical chain,
 * what blocks it, and the concrete problems a reader would otherwise have to reconstruct by hand.
 * Every number here is already authoritative somewhere else in the app — this only gathers them.
 */
export function TaskReport({ task, statuses }: { task: TaskDetail; statuses: ProjectStatus[] }) {
  const t = useTranslations('TaskReport');
  const locale = useLocale();
  const { data: entries = [] } = useTaskTime(task.id);
  const { data: schedule } = useTaskSchedule(task.id);
  const { data: dependencies = [] } = useDependencies(task.projectId);

  const timings = schedule?.tasks.find((row) => row.id === task.id);
  const trackedMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
  const openTimerMinutes = entries
    .filter((entry) => entry.endedAt === null)
    .reduce((sum, entry) => sum + entry.minutes, 0);

  const status = statuses.find((candidate) => candidate.key === task.statusKey);
  const done = task.subtasks.filter((sub) => sub.status === 'DONE').length;
  const total = task.subtasks.length;
  const isDone = task.status === 'DONE';

  const blockedBy = dependencies.filter((dep) => dep.successorId === task.id).map((d) => d.predecessorId);
  const blocking = dependencies.filter((dep) => dep.predecessorId === task.id).map((d) => d.successorId);
  const overdue = isOverdue(task);
  // One clock read for the whole report, so every relative number below agrees on "today".
  const now = new Date().getTime();
  const overdueDays = task.dueDate
    ? Math.max(0, Math.ceil((now - Date.parse(task.dueDate)) / DAY_MS))
    : 0;
  const daysLeft = task.dueDate ? Math.ceil((Date.parse(task.dueDate) - now) / DAY_MS) : null;
  const staleDays = Math.floor((now - Date.parse(task.updatedAt)) / DAY_MS);

  // A handful of pushes rebuilt per render; the compiler memoizes it without a manual dep list
  // (which it cannot reconcile against the derived numbers above).
  const signals: Signal[] = [];
  if (overdue) signals.push({ icon: CalendarClock, label: t('signalOverdue', { days: overdueDays }), tone: 'danger' });
  if (!isDone && !task.assignee) signals.push({ icon: UserX, label: t('signalUnassigned'), tone: 'warn' });
  if (!isDone && task.estimateHours == null) signals.push({ icon: CircleSlash, label: t('signalNoEstimate'), tone: 'warn' });
  if (task.estimateHours != null && trackedMinutes > task.estimateHours * 60 && !isDone) {
    signals.push({
      icon: Clock,
      label: t('signalOverBudget', {
        tracked: trackedHours(trackedMinutes),
        estimate: formatNumber(task.estimateHours, locale),
      }),
      tone: 'danger',
    });
  }
  if (blockedBy.length > 0 && !isDone) {
    signals.push({ icon: GitBranch, label: t('signalBlocked', { count: blockedBy.length }), tone: 'warn' });
  }
  if (timings?.isCritical && !isDone) signals.push({ icon: Route, label: t('signalCritical'), tone: 'info' });
  if (!isDone && staleDays >= STALE_DAYS) {
    signals.push({ icon: Clock, label: t('signalStale', { days: staleDays }), tone: 'info' });
  }

  const trackedHoursOf = (minutes: number) => formatNumber(Math.round((minutes / 60) * 10) / 10, locale);

  return (
    <section className="flex flex-col gap-3" aria-label={t('title')}>
      <h3 className="text-sm font-semibold">{t('title')}</h3>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fact label={t('status')}>
          {status ? <StatusBadge status={status} /> : <span className="text-xs">{task.statusKey}</span>}
        </Fact>
        <Fact label={t('progress')}>
          <span className="text-sm">
            {total > 0 ? t('subtaskProgress', { done, total }) : t('noSubtasks')}
          </span>
          {total > 0 && (
            <Progress
              value={(done / total) * 100}
              className="mt-1 h-1.5"
              aria-label={t('progress')}
            />
          )}
        </Fact>
        <Fact label={t('effort')}>
          <span className="text-sm">
            {isDone
              ? t('effortDone')
              : task.estimateHours == null
                ? t('noEstimate')
                : `${trackedHoursOf(trackedMinutes + openTimerMinutes)} / ${formatNumber(task.estimateHours, locale)} h`}
          </span>
          {task.estimateHours != null && (
            <Progress
              value={Math.min(100, ((trackedMinutes + openTimerMinutes) / 60 / task.estimateHours) * 100)}
              className="mt-1 h-1.5"
              aria-label={t('effort')}
            />
          )}
        </Fact>
        <Fact label={t('due')}>
          <span className="text-sm">
            {task.dueDate
              ? overdue
                ? t('overdueBy', { days: overdueDays })
                : daysLeft === 0
                  ? t('dueToday')
                  : t('dueIn', { days: daysLeft ?? 0 })
              : t('noDueDate')}
          </span>
        </Fact>
        <Fact label={t('slack')}>
          <span className="text-sm">
            {timings?.slack == null
              ? t('unknown')
              : timings.isCritical
                ? t('critical')
                : `${formatNumber(Math.round(timings.slack), locale)} h`}
          </span>
        </Fact>
        <Fact label={t('blocking')}>
          <span className="text-sm">
            {blockedBy.length === 0 && blocking.length === 0
              ? t('noLinks')
              : t('links', { blockedBy: blockedBy.length, blocking: blocking.length })}
          </span>
        </Fact>
      </div>

      {signals.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {signals.map((signal) => (
            <li
              key={signal.label}
              className={
                signal.tone === 'danger'
                  ? 'text-destructive flex items-center gap-1 rounded-full border border-destructive/40 px-2 py-0.5 text-[11px]'
                  : signal.tone === 'warn'
                    ? 'flex items-center gap-1 rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] text-amber-600'
                    : 'text-muted-foreground flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]'
              }
            >
              <signal.icon className="size-3" aria-hidden />
              {signal.label}
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1">
          <Clock className="size-3" aria-hidden />
          {t('trackedTotal', { hours: trackedHoursOf(trackedMinutes) })}
        </span>
        <span className="inline-flex items-center gap-1">
          <CheckSquare className="size-3" aria-hidden />
          {t('comments', { count: task.commentCount })}
        </span>
        <span>
          {t('timestamps', {
            created: formatDate(task.createdAt, locale, { month: 'short', day: 'numeric' }),
            updated: formatDate(task.updatedAt, locale, { month: 'short', day: 'numeric' }),
          })}
        </span>
      </p>
    </section>
  );
}

/** Hours rendered with one decimal, locale-aware. */
function trackedHours(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10);
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-muted-foreground text-[11px] tracking-wide uppercase">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
