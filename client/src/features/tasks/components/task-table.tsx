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
import { useBulkUpdate } from '../hooks/use-bulk';
import { formatNumber } from '@/lib/format';
import { StatusBadge, sortStatuses, type ProjectStatus } from '@/features/statuses';
import { TASK_PRIORITIES, type Task } from '../types';
import { DueDate, PriorityBadge } from './task-badges';
import { AssigneeStack } from './task-fields';

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'points';

/** Sorts status by the project's own board order, so the table agrees with the kanban. */
const makeCompare = (statuses: ProjectStatus[]): Record<SortKey, (a: Task, b: Task) => number> => {
  const order = new Map(sortStatuses(statuses).map((status, index) => [status.key, index]));
  return {
    title: (a, b) => a.title.localeCompare(b.title),
    status: (a, b) =>
      (order.get(a.statusKey) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.statusKey) ?? Number.MAX_SAFE_INTEGER),
    priority: (a, b) => TASK_PRIORITIES.indexOf(a.priority) - TASK_PRIORITIES.indexOf(b.priority),
    // Ordered by the lead — the person the task is counted against.
    assignee: (a, b) =>
      (a.assignees[0]?.name ?? '￿').localeCompare(b.assignees[0]?.name ?? '￿'),
    dueDate: (a, b) =>
      (a.dueDate ? Date.parse(a.dueDate) : Infinity) - (b.dueDate ? Date.parse(b.dueDate) : Infinity),
    points: (a, b) => (a.points ?? -1) - (b.points ?? -1),
  };
};

export function TaskTable({
  tasks,
  statuses = [],
  onOpen,
  showProject = false,
  projectId,
}: {
  tasks: Task[];
  /** The project's workflow columns — used for the status badge and the sort order. */
  statuses?: ProjectStatus[];
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
  const compare = useMemo(() => makeCompare(statuses), [statuses]);

  const toggle = (id: number, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const rows = useMemo(
    () => [...tasks].sort((a, b) => compare[sort.key](a, b) * sort.dir || a.position - b.position),
    [compare, sort, tasks],
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
              {(() => {
                const status = statuses.find((candidate) => candidate.key === task.statusKey);
                // A column deleted while this page was open still has to render something.
                return status ? (
                  <StatusBadge status={status} />
                ) : (
                  <span className="text-muted-foreground text-xs">{task.statusKey}</span>
                );
              })()}
            </TableCell>
            <TableCell>
              <PriorityBadge priority={task.priority} />
            </TableCell>
            <TableCell>
              {task.assignees.length > 0 ? (
                <span className="flex items-center gap-2">
                  <AssigneeStack assignees={task.assignees} max={2} />
                  <span>
                    {task.assignees[0].name}
                    {task.assignees.length > 1 && (
                      <span className="text-muted-foreground">
                        {' '}
                        +{task.assignees.length - 1}
                      </span>
                    )}
                  </span>
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
