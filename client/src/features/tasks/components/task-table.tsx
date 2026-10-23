'use client';

import { useMemo, useRef, useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import type { ListGroup } from '../api/saved-views.api';
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

interface Group {
  key: string;
  label: string;
  tasks: Task[];
}

/** §4 group-by: the lead assignee, priority or workflow column — sum of estimates per group. */
function groupTasks(
  tasks: Task[],
  groupBy: ListGroup,
  statuses: ProjectStatus[],
  labels: { unassigned: string; priorities: (priority: Task['priority']) => string; statuses: (key: string) => string },
): Group[] {
  if (groupBy === 'none') return [{ key: 'all', label: '', tasks }];

  const groups = new Map<string, Group>();
  for (const task of tasks) {
    const key =
      groupBy === 'assignee'
        ? String(task.assignees[0]?.id ?? 0)
        : groupBy === 'priority'
          ? task.priority
          : task.statusKey;
    const label =
      groupBy === 'assignee'
        ? (task.assignees[0]?.name ?? labels.unassigned)
        : groupBy === 'priority'
          ? labels.priorities(task.priority)
          : labels.statuses(task.statusKey);
    const group = groups.get(key) ?? { key, label, tasks: [] };
    group.tasks.push(task);
    groups.set(key, group);
  }

  const list = [...groups.values()];
  if (groupBy === 'assignee') list.sort((a, b) => a.label.localeCompare(b.label));
  if (groupBy === 'priority') {
    list.sort(
      (a, b) =>
        TASK_PRIORITIES.indexOf(a.tasks[0]!.priority) - TASK_PRIORITIES.indexOf(b.tasks[0]!.priority),
    );
  }
  if (groupBy === 'status') {
    const order = new Map(sortStatuses(statuses).map((status, index) => [status.key, index]));
    list.sort(
      (a, b) =>
        (order.get(a.tasks[0]!.statusKey) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.tasks[0]!.statusKey) ?? Number.MAX_SAFE_INTEGER),
    );
  }
  return list;
}

/** §4 inline editing: the title becomes an input on double click, Enter/blur saves, Esc cancels. */
function TitleCell({
  task,
  onPatch,
}: {
  task: Task;
  onPatch?: (taskId: number, patch: { title: string }) => void;
}) {
  const t = useTranslations('Tasks');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(task.title);
  const input = useRef<HTMLInputElement>(null);

  if (!onPatch) return <span className="font-medium">{task.title}</span>;

  const commit = () => {
    setEditing(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === task.title) {
      setValue(task.title);
      return;
    }
    onPatch(task.id, { title: trimmed });
  };

  return editing ? (
    <Input
      ref={input}
      autoFocus
      value={value}
      maxLength={200}
      aria-label={t('titleLabel')}
      className="h-8"
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          setValue(task.title);
          setEditing(false);
        }
      }}
    />
  ) : (
    <button
      type="button"
      title={t('inlineEditHint')}
      className="cursor-text text-start font-medium"
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => {
        event.stopPropagation();
        setEditing(true);
      }}
    >
      {task.title}
    </button>
  );
}

export function TaskTable({
  tasks,
  statuses = [],
  onOpen,
  showProject = false,
  projectId,
  groupBy = 'none',
  onPatch,
}: {
  tasks: Task[];
  /** The project's workflow columns — used for the status badge and the sort order. */
  statuses?: ProjectStatus[];
  onOpen: (taskId: number) => void;
  showProject?: boolean;
  /** When given, §4 bulk-selection checkboxes appear (project-scoped tables only). */
  projectId?: number;
  /** §4 list grouping (assignee / priority / column) with per-group totals. */
  groupBy?: ListGroup;
  /** §4 inline editing — omitted for readers, which keeps the cells read-only. */
  onPatch?: (taskId: number, patch: { title?: string; statusKey?: string; priority?: Task['priority'] }) => void;
}) {
  const t = useTranslations('Tasks');
  const ts = useTranslations('Tasks.status');
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

  const groups = useMemo(
    () =>
      groupTasks(rows, groupBy, statuses, {
        unassigned: t('unassigned'),
        priorities: (priority) => t(`priority.${priority}`),
        statuses: (key) =>
          ts.has(key) ? ts(key) : (statuses.find((status) => status.key === key)?.label ?? key),
      }),
    [rows, groupBy, statuses, t, ts],
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
        {groups.map((group) => {
          const estimate = group.tasks.reduce((sum, task) => sum + (task.estimateHours ?? 0), 0);
          return [
            groupBy !== 'none' && (
              <TableRow
                key={`group-${group.key}`}
                data-group-key={group.key}
                className="bg-muted/50 hover:bg-muted/50"
              >
                <TableCell colSpan={projectId ? 8 : 7} className="py-1.5">
                  <span className="flex items-center gap-2 text-xs font-medium">
                    {group.label}
                    <span className="text-muted-foreground">
                      · {t('groupCount', { count: group.tasks.length })}
                      {estimate > 0 && ` · ${t('groupEstimate', { hours: formatNumber(estimate, locale) })}`}
                    </span>
                  </span>
                </TableCell>
              </TableRow>
            ),
            ...group.tasks.map((task) => (
            <TableRow
              key={task.id}
              className="cursor-pointer"
              tabIndex={0}
              data-task-id={task.id}
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
              <TableCell className="max-w-72 truncate">
                <TitleCell task={task} onPatch={onPatch} />
              </TableCell>
              {showProject && <TableCell className="text-muted-foreground">{task.project.name}</TableCell>}
              <TableCell onClick={(event) => event.stopPropagation()}>
                {onPatch ? (
                  <Select
                    value={task.statusKey}
                    onValueChange={(statusKey) => onPatch(task.id, { statusKey })}
                  >
                    <SelectTrigger size="sm" className="w-36" aria-label={t('statusLabel')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sortStatuses(statuses).map((status) => (
                        <SelectItem key={status.key} value={status.key}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  (() => {
                    const status = statuses.find((candidate) => candidate.key === task.statusKey);
                    // A column deleted while this page was open still has to render something.
                    return status ? (
                      <StatusBadge status={status} />
                    ) : (
                      <span className="text-muted-foreground text-xs">{task.statusKey}</span>
                    );
                  })()
                )}
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                {onPatch ? (
                  <Select
                    value={task.priority}
                    onValueChange={(priority) => onPatch(task.id, { priority: priority as Task['priority'] })}
                  >
                    <SelectTrigger size="sm" className="w-28" aria-label={t('priorityLabel')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {t(`priority.${priority}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <PriorityBadge priority={task.priority} />
                )}
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
            )),
          ];
        })}
      </TableBody>
    </Table>
    </div>
  );
}
