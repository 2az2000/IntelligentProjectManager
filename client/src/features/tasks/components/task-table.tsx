'use client';

import { useMemo, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useBulkUpdate } from '../hooks/use-bulk';
import { formatNumber } from '@/lib/format';
import { TASK_PRIORITIES, TASK_STATUSES, type Task } from '../types';
import { DueDate, PriorityBadge, StatusBadge } from './task-badges';

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'points';

const compare: Record<SortKey, (a: Task, b: Task) => number> = {
  title: (a, b) => a.title.localeCompare(b.title),
  status: (a, b) => TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status),
  priority: (a, b) => TASK_PRIORITIES.indexOf(a.priority) - TASK_PRIORITIES.indexOf(b.priority),
  assignee: (a, b) => (a.assignee?.name ?? '￿').localeCompare(b.assignee?.name ?? '￿'),
  dueDate: (a, b) =>
    (a.dueDate ? Date.parse(a.dueDate) : Infinity) - (b.dueDate ? Date.parse(b.dueDate) : Infinity),
  points: (a, b) => (a.points ?? -1) - (b.points ?? -1),
};

export function TaskTable({
  tasks,
  onOpen,
  showProject = false,
  projectId,
}: {
  tasks: Task[];
  onOpen: (taskId: number) => void;
  showProject?: boolean;
  /** When given, §4 bulk-selection checkboxes appear (project-scoped tables only). */
  projectId?: number;
}) {
  const t = useTranslations('Tasks');
  const locale = useLocale();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'status', dir: 1 });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const bulk = useBulkUpdate(projectId ?? 0);

  const toggle = (id: number, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const rows = useMemo(
    () => [...tasks].sort((a, b) => compare[sort.key](a, b) * sort.dir || a.position - b.position),
    [tasks, sort],
  );

  const header = (key: SortKey, label: string, className = 'text-start') => (
    <TableHead className={className} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
      >
        {label}
        <ArrowUpDown className="size-3" aria-hidden />
      </button>
    </TableHead>
  );

  return (
    <div>
    {projectId && selected.size > 0 && (
      <div className="bg-muted/60 mb-2 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
        <span className="text-sm">{formatNumber(selected.size, locale)} ✓</span>
        <button
          type="button"
          className="hover:bg-accent rounded border px-2 py-1 text-xs"
          onClick={() =>
            bulk.mutate(
              { ids: [...selected], patch: { status: 'DONE' } },
              { onSuccess: () => setSelected(new Set()) },
            )
          }
        >
          {t('markDone')}
        </button>
        <button
          type="button"
          className="hover:bg-accent rounded border px-2 py-1 text-xs"
          onClick={() =>
            bulk.mutate(
              { ids: [...selected], patch: { assigneeId: null } },
              { onSuccess: () => setSelected(new Set()) },
            )
          }
        >
          {t('unassign')}
        </button>
      </div>
    )}
    <Table>
      <TableHeader>
        <TableRow>
          {projectId && <TableHead className="w-8" aria-label="select" />}
          {header('title', t('titleLabel'))}
          {showProject && <TableHead className="text-start">{t('projectLabel')}</TableHead>}
          {header('status', t('statusLabel'))}
          {header('priority', t('priorityLabel'))}
          {header('assignee', t('assigneeLabel'))}
          {header('dueDate', t('dueDateLabel'))}
          {header('points', t('pointsLabel'), 'text-end')}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((task) => (
          <TableRow
            key={task.id}
            className="cursor-pointer"
            tabIndex={0}
            onClick={() => onOpen(task.id)}
            onKeyDown={(e) => e.key === 'Enter' && onOpen(task.id)}
          >
            {projectId && (
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  aria-label={task.title}
                  checked={selected.has(task.id)}
                  onCheckedChange={(checked) => toggle(task.id, checked === true)}
                />
              </TableCell>
            )}
            <TableCell className="max-w-72 truncate font-medium">{task.title}</TableCell>
            {showProject && <TableCell className="text-muted-foreground">{task.project.name}</TableCell>}
            <TableCell>
              <StatusBadge status={task.status} />
            </TableCell>
            <TableCell>
              <PriorityBadge priority={task.priority} />
            </TableCell>
            <TableCell>
              {task.assignee ? (
                <span className="flex items-center gap-2">
                  <UserAvatar user={task.assignee} className="size-6" />
                  {task.assignee.name}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>{task.dueDate ? <DueDate task={task} /> : <span className="text-muted-foreground">—</span>}</TableCell>
            <TableCell className="text-end">{task.points != null ? formatNumber(task.points, locale) : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
