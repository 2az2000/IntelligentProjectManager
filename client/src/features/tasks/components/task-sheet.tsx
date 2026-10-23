'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DatePicker } from '@/components/shared/date-picker';
import { ErrorState } from '@/components/shared/error-state';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useCurrentUser } from '@/features/auth';
import { ActivityTimeline } from '@/features/activity';
import { AttachmentsSection } from '@/features/attachments';
import { LabelPicker } from '@/features/labels';
import { hasRole, useProject, useProjectMembers } from '@/features/projects';
import { useTaskPresence } from '@/features/realtime';
import { DependenciesSection } from '@/features/scheduling';
import {
  FALLBACK_STATUSES,
  sortStatuses,
  useProjectStatuses,
  type ProjectStatus,
} from '@/features/statuses';
import { useErrorMessage } from '@/hooks/use-error-message';
import { Link } from '@/i18n/navigation';
import { toDayIso } from '@/lib/calendar';
import { formatDate, formatNumber } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import type { UpdateTaskInput } from '../api/task.api';
import { toAssigneeIds } from '../lib/assignees';
import {
  useCreateTask,
  useDeleteTask,
  useRestoreTask,
  useTask,
  useUpdateTask,
} from '../hooks/use-tasks';
import { useTaskSheet } from '../hooks/use-task-sheet';
import type { TaskDateConflict, TaskDetail } from '../types';
import { DateConflictNotice } from './date-conflict-notice';
import { RichTextEditor, plainToHtml } from './rich-text-editor';
import { TaskComments } from './task-comments';
import { TaskReport } from './task-report';
import { TimeTracker } from './time-tracker';
import { AssigneePicker, PrioritySelect, StatusSelect } from './task-fields';

/** Global task detail panel, opened by `?task=<id>` on any page of the app. */
export function TaskSheet() {
  const locale = useLocale();
  const param = useSearchParams().get('task');
  const taskId = param ? Number(param) : null;
  const { closeTask } = useTaskSheet();
  const { data: task, isPending, isError, error, refetch } = useTask(taskId);
  // §4 Productivity — the last PATCH's date-vs-dependency warnings. They live in their own cache
  // entry (written by `useUpdateTask`) because the sheet body remounts on every save and would
  // drop local state. Never fetched: `enabled` is false, only a mutation writes here.
  const queryClient = useQueryClient();
  const { data: conflicts = [] } = useQuery({
    queryKey: qk.taskWarnings(taskId ?? 0),
    queryFn: () => [] as TaskDateConflict[],
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return (
    <Sheet open={taskId !== null} onOpenChange={(open) => !open && closeTask()}>
      <SheetContent
        side={locale === 'fa' ? 'left' : 'right'}
        className="w-full gap-0 overflow-y-auto sm:max-w-xl"
      >
        {isError ? (
          <div className="p-6">
            <SheetTitle className="sr-only">{String(taskId)}</SheetTitle>
            <ErrorState error={error} onRetry={() => refetch()} />
          </div>
        ) : isPending || !task ? (
          <div className="flex h-40 items-center justify-center">
            <SheetTitle className="sr-only">…</SheetTitle>
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <TaskDetailBody
            key={`${task.id}-${task.updatedAt}`}
            task={task}
            conflicts={conflicts}
            onDismissWarnings={() => queryClient.setQueryData(qk.taskWarnings(task.id), [])}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * §Imp §5 — task-level presence: "three people have this open" before you start editing, so two
 * people don't quietly rewrite the same description. The server tracks sockets per task; this
 * only renders the answer for the people we can name from the member list.
 */
function TaskViewers({
  taskId,
  projectId,
  members,
  selfId,
}: {
  taskId: number;
  projectId: number;
  members: { user: { id: number; name: string; avatarUrl: string | null } }[];
  selfId: number | undefined;
}) {
  const t = useTranslations('Realtime');
  const viewers = useTaskPresence(projectId, taskId);
  const others = members
    .filter((member) => viewers.includes(member.user.id) && member.user.id !== selfId)
    .map((member) => member.user);
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
      <div className="flex -space-x-2 space-x-reverse">
        {others.slice(0, 4).map((user) => (
          <UserAvatar key={user.id} user={user} className="size-6 ring-2 ring-background" />
        ))}
      </div>
      <span>{t('viewingTask', { count: others.length })}</span>
    </div>
  );
}

function TaskDetailBody({
  task,
  conflicts,
  onDismissWarnings,
}: {
  task: TaskDetail;
  conflicts: TaskDateConflict[];
  onDismissWarnings: () => void;
}) {
  const t = useTranslations('Tasks');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { openTask, closeTask } = useTaskSheet();
  const { data: me } = useCurrentUser();
  const { data: project } = useProject(task.projectId);
  const { data: members = [] } = useProjectMembers(task.projectId);
  // The status picker offers the project's own columns, not a hard-coded four.
  const { data: projectStatuses } = useProjectStatuses(task.projectId);
  const statuses = sortStatuses(projectStatuses ?? FALLBACK_STATUSES);
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const restore = useRestoreTask(task.projectId);

  const role = project?.myRole ?? 'VIEWER';
  const canEdit = hasRole(role, 'MEMBER');
  const canDelete = canEdit && (task.author.id === me?.id || hasRole(role, 'ADMIN'));
  const assignable = members.filter((m) => hasRole(m.role, 'MEMBER')).map((m) => m.user);
  const memberName = (id: string): string | null =>
    members.find((m) => m.user.id === Number(id))?.user.name ?? null;

  const [title, setTitle] = useState(task.title);
  const [descriptionHtml, setDescriptionHtml] = useState(
    task.descriptionHtml ?? plainToHtml(task.description),
  );
  // Plain strings, exactly as the API stores them — labels are a presentation layer on top.
  const [tags, setTags] = useState<string[]>(task.tags);
  const [points, setPoints] = useState(task.points?.toString() ?? '');
  const [estimateHours, setEstimateHours] = useState(task.estimateHours?.toString() ?? '');

  const save = (input: UpdateTaskInput) =>
    update.mutate({ taskId: task.id, input }, { onError: (error) => toast.error(toMessage(error)) });

  const saveTitle = () => {
    const value = title.trim();
    if (value && value !== task.title) save({ title: value });
    else setTitle(task.title);
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <SheetHeader className="gap-1 p-0">
        <SheetDescription asChild>
          <Link href={`/app/projects/${task.projectId}/board`} className="text-xs hover:underline">
            {task.project.name}
            {task.parentId && ` · ${t('subtask')}`}
          </Link>
        </SheetDescription>
        <SheetTitle className="sr-only">{task.title}</SheetTitle>
        <Input
          aria-label={t('titleLabel')}
          value={title}
          disabled={!canEdit}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-auto border-none px-0 text-xl font-semibold shadow-none focus-visible:ring-0 disabled:opacity-100"
        />
      </SheetHeader>

      <TaskViewers taskId={task.id} projectId={task.projectId} members={members} selfId={me?.id} />

      <DateConflictNotice
        conflicts={conflicts}
        onOpenTask={(id) => openTask(id)}
        onDismiss={onDismissWarnings}
      />

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label={t('statusLabel')} id="task-status">
          <StatusSelect
            id="task-status"
            value={task.statusKey}
            statuses={statuses}
            disabled={!canEdit}
            onChange={(statusKey) => save({ statusKey })}
          />
        </Field>
        <Field label={t('priorityLabel')} id="task-priority">
          <PrioritySelect
            id="task-priority"
            value={task.priority}
            disabled={!canEdit}
            onChange={(priority) => save({ priority })}
          />
        </Field>
        <Field label={t('assigneeLabel')} id="task-assignee">
          {/* The whole team on the task: checkboxes, one of them the lead. */}
          <AssigneePicker
            id="task-assignee"
            value={toAssigneeIds(task.assignees)}
            members={assignable}
            disabled={!canEdit}
            onChange={(assigneeIds) => save({ assigneeIds })}
          />
        </Field>
        <Field label={t('dueDateLabel')} id="task-due">
          <DatePicker
            id="task-due"
            value={task.dueDate ? new Date(task.dueDate) : null}
            disabled={!canEdit}
            onChange={(date) => save({ dueDate: date ? toDayIso(date) : null })}
          />
        </Field>
        <Field label={t('pointsLabel')} id="task-points">
          <Input
            id="task-points"
            type="number"
            min={0}
            max={1000}
            value={points}
            disabled={!canEdit}
            onChange={(e) => setPoints(e.target.value)}
            onBlur={() => {
              const next = points === '' ? null : Math.max(0, Math.min(1000, Math.round(Number(points))));
              if (next !== task.points && (next === null || Number.isFinite(next))) save({ points: next });
            }}
          />
        </Field>
        <Field label={t('estimateHoursLabel')} id="task-estimate">
          <Input
            id="task-estimate"
            type="number"
            min={0}
            max={10000}
            step="0.5"
            value={estimateHours}
            disabled={!canEdit}
            onChange={(e) => setEstimateHours(e.target.value)}
            onBlur={() => {
              const next = estimateHours === '' ? null : Math.max(0, Math.min(10000, Number(estimateHours)));
              if (next !== task.estimateHours && (next === null || Number.isFinite(next))) save({ estimateHours: next });
            }}
          />
        </Field>
        <Field label={t('tagsLabel')} id="task-tags">
          <LabelPicker
            projectId={task.projectId}
            value={tags}
            disabled={!canEdit}
            onChange={(next) => {
              setTags(next);
              save({ tags: next });
            }}
          />
        </Field>
      </div>

      {/* What the numbers actually say: planned vs booked, blockers, criticality, stale/overdue. */}
      <TaskReport task={task} statuses={statuses} />

      <Field label={t('descriptionLabel')} id="task-description">
        {/* §4 rich text: sanitized server-side, plain-text twin kept for search/AI. */}
        <RichTextEditor
          value={descriptionHtml}
          editable={canEdit}
          placeholder={t('descriptionPlaceholder')}
          onChange={setDescriptionHtml}
          onBlur={() => {
            const current = task.descriptionHtml ?? plainToHtml(task.description);
            if (descriptionHtml !== current) {
              save({ descriptionHtml: descriptionHtml.trim() ? descriptionHtml : null });
            }
          }}
        />
      </Field>

      {/* §6 time tracking — stopwatch + manual entries (VIEWER+ can read). */}
      <TimeTracker taskId={task.id} />

      {task.parentId === null && (
        <>
          <Subtasks task={task} canEdit={canEdit} onOpen={openTask} statuses={statuses} />
          <DependenciesSection task={task} canEdit={canEdit} />
        </>
      )}

      <Separator />
      <TaskComments
        taskId={task.id}
        members={assignable}
        canComment={canEdit}
        isAdmin={hasRole(role, 'ADMIN')}
      />
      <Separator />
      <AttachmentsSection taskId={task.id} canEdit={canEdit} />
      <Separator />
      <ActivityTimeline taskId={task.id} resolveUser={memberName} />
      <Separator />

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {t('createdBy', { name: task.author.name, date: formatDate(task.createdAt, locale) })}
        </span>
        {canDelete && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="gap-1 text-destructive">
                <Trash2 className="size-4" aria-hidden />
                {t('delete')}
              </Button>
            }
            title={t('deleteTitle', { title: task.title })}
            description={t('deleteDescription', { title: task.title })}
            confirmLabel={t('delete')}
            onConfirm={() =>
              remove.mutate(task.id, {
                onSuccess: () => {
                  // §4 undo: deleting is reversible for a few seconds (soft delete + restore).
                  toast.success(t('deleted'), {
                    action: {
                      label: t('undo'),
                      onClick: () =>
                        restore.mutate(task.id, {
                          onSuccess: () => {
                            toast.success(t('restored'));
                            openTask(task.id);
                          },
                          onError: (error) => toast.error(toMessage(error)),
                        }),
                    },
                  });
                  if (task.parentId) openTask(task.parentId);
                  else closeTask();
                },
                onError: (error) => toast.error(toMessage(error)),
              })
            }
          />
        )}
      </div>
    </div>
  );
}

function Subtasks({
  task,
  canEdit,
  onOpen,
  statuses,
}: {
  task: TaskDetail;
  canEdit: boolean;
  onOpen: (taskId: number) => void;
  statuses: ProjectStatus[];
}) {
  const t = useTranslations('Tasks');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const update = useUpdateTask();
  const create = useCreateTask(task.projectId);
  const [title, setTitle] = useState('');
  const done = task.subtasks.filter((s) => s.status === 'DONE').length;
  const total = task.subtasks.length;
  // "Done" may be a renamed or custom column; tick means *its* done column, untick the first one.
  const doneKey = statuses.find((status) => status.category === 'DONE')?.key ?? 'DONE';
  const startKey = statuses[0]?.key ?? 'TODO';

  const add = () => {
    const value = title.trim();
    if (!value) return;
    create.mutate(
      { title: value, parentId: task.id },
      { onSuccess: () => setTitle(''), onError: (error) => toast.error(toMessage(error)) },
    );
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('subtasks')}</h3>
        {total > 0 && (
          <span className="text-xs text-muted-foreground">
            {formatNumber(done, locale)}/{formatNumber(total, locale)}
          </span>
        )}
      </div>
      {total > 0 && <Progress value={(done / total) * 100} aria-label={t('subtasks')} />}
      <ul className="flex flex-col gap-1">
        {task.subtasks.map((sub) => (
          <li key={sub.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60">
            <Checkbox
              checked={sub.status === 'DONE'}
              disabled={!canEdit}
              aria-label={sub.title}
              onCheckedChange={(checked) =>
                update.mutate(
                  { taskId: sub.id, input: { statusKey: checked ? doneKey : startKey } },
                  { onError: (error) => toast.error(toMessage(error)) },
                )
              }
            />
            <button
              type="button"
              className={`flex-1 text-start text-sm ${sub.status === 'DONE' ? 'text-muted-foreground line-through' : ''}`}
              onClick={() => onOpen(sub.id)}
            >
              {sub.title}
            </button>
          </li>
        ))}
      </ul>
      {canEdit && (
        <div className="flex gap-2">
          <Input
            value={title}
            placeholder={t('addSubtask')}
            aria-label={t('addSubtask')}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button size="icon" variant="outline" onClick={add} disabled={!title.trim() || create.isPending} aria-label={t('addSubtask')}>
            <Plus className="size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

