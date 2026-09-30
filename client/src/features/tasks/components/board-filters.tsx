'use client';

import { Search, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TASK_PRIORITIES, type Task, type TaskFilters, type UserSummary } from '../types';

const ALL = 'all';
const UNASSIGNED = 'none';

export function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  const search = filters.search?.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (!search ||
        t.title.toLowerCase().includes(search) ||
        t.tags.some((tag) => tag.toLowerCase().includes(search))) &&
      (filters.priority === undefined || t.priority === filters.priority) &&
      (filters.assigneeId === undefined ||
        (filters.assigneeId === 0 ? t.assignee === null : t.assignee?.id === filters.assigneeId)),
  );
}

/** One row of filters above the board / list. `assigneeId: 0` means "unassigned". */
export function BoardFilters({
  filters,
  onChange,
  members,
}: {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  members: UserSummary[];
}) {
  const t = useTranslations('Tasks');
  const active = !!filters.search || filters.priority !== undefined || filters.assigneeId !== undefined;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={filters.search ?? ''}
          onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="ps-8"
        />
      </div>
      <Select
        value={filters.assigneeId === undefined ? ALL : filters.assigneeId === 0 ? UNASSIGNED : String(filters.assigneeId)}
        onValueChange={(v) =>
          onChange({ ...filters, assigneeId: v === ALL ? undefined : v === UNASSIGNED ? 0 : Number(v) })
        }
      >
        <SelectTrigger className="w-44" aria-label={t('assigneeLabel')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allAssignees')}</SelectItem>
          <SelectItem value={UNASSIGNED}>{t('unassigned')}</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={String(m.id)}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.priority ?? ALL}
        onValueChange={(v) =>
          onChange({ ...filters, priority: v === ALL ? undefined : (v as TaskFilters['priority']) })
        }
      >
        <SelectTrigger className="w-40" aria-label={t('priorityLabel')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('allPriorities')}</SelectItem>
          {TASK_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {t(`priority.${p}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})} className="gap-1">
          <X className="size-4" aria-hidden />
          {t('clearFilters')}
        </Button>
      )}
    </div>
  );
}
