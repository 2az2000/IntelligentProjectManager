'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, Plus, Sparkles, Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DatePicker } from '@/components/shared/date-picker';
import { ErrorState } from '@/components/shared/error-state';
import { useCurrentUser } from '@/features/auth';
import { ActivityTimeline } from '@/features/activity';
import { AttachmentsSection } from '@/features/attachments';
import { useAiEstimate } from '@/features/ai';
import { hasRole, useProject, useProjectMembers } from '@/features/projects';
import { DependenciesSection } from '@/features/scheduling';
import { useErrorMessage } from '@/hooks/use-error-message';
import { Link } from '@/i18n/navigation';
import { toDayIso } from '@/lib/calendar';
import { formatDate, formatNumber } from '@/lib/format';
import type { UpdateTaskInput } from '../api/task.api';
import { useCreateTask, useDeleteTask, useTask, useUpdateTask } from '../hooks/use-tasks';
import { useTaskSheet } from '../hooks/use-task-sheet';
import { parseTags } from '../schemas/task.schema';
import type { TaskDetail } from '../types';
import { TaskComments } from './task-comments';
import { TimeTracker } from './time-tracker';
import { AssigneeSelect, PrioritySelect, StatusSelect } from './task-fields';

/** Global task detail panel, opened by `?task=<id>` on any page of the app. */
export function TaskSheet() {
  const locale = useLocale();
  const param = useSearchParams().get('task');
  const taskId = param ? Number(param) : null;
  const { closeTask } = useTaskSheet();
  const { data: task, isPending, isError, error, refetch } = useTask(taskId);

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
          <TaskDetailBody key={`${task.id}-${task.updatedAt}`} task={task} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TaskDetailBody({ task }: { task: TaskDetail }) {
  const t = useTranslations('Tasks');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { openTask, closeTask } = useTaskSheet();
  const { data: me } = useCurrentUser();
  const { data: project } = useProject(task.projectId);
  const { data: members = [] } = useProjectMembers(task.projectId);
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const role = project?.myRole ?? 'VIEWER';
  const canEdit = hasRole(role, 'MEMBER');
  const canDelete = canEdit && (task.author.id === me?.id || hasRole(role, 'ADMIN'));
  const assignable = members.filter((m) => hasRole(m.role, 'MEMBER')).map((m) => m.user);
  const memberName = (id: string): string | null =>
    members.find((m) => m.user.id === Number(id))?.user.name ?? null;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [tags, setTags] = useState(task.tags.join(', '));
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
          <Link href={`/projects/${task.projectId}/board`} className="text-xs hover:underline">
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

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Field label={t('statusLabel')} id="task-status">
          <StatusSelect id="task-status" value={task.status} disabled={!canEdit} onChange={(status) => save({ status })} />
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
          <AssigneeSelect
            id="task-assignee"
            value={task.assignee?.id ?? null}
            members={assignable}
            disabled={!canEdit}
            onChange={(assigneeId) => save({ assigneeId })}
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
          <div className="flex items-center gap-1">
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
            {canEdit && task.parentId === null && <AiEstimateButton projectId={task.projectId} title={task.title} onApply={(hours) => { setEstimateHours(String(hours)); save({ estimateHours: hours }); }} />}
          </div>
        </Field>
        <Field label={t('tagsLabel')} id="task-tags">
          <Input
            id="task-tags"
            value={tags}
            placeholder={t('tagsPlaceholder')}
            disabled={!canEdit}
            onChange={(e) => setTags(e.target.value)}
            onBlur={() => {
              const next = parseTags(tags);
              if (next.join('|') !== task.tags.join('|')) save({ tags: next });
            }}
          />
        </Field>
      </div>

      <Field label={t('descriptionLabel')} id="task-description">
        <Textarea
          id="task-description"
          rows={4}
          value={description}
          placeholder={t('descriptionPlaceholder')}
          disabled={!canEdit}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => {
            if (description.trim() !== (task.description ?? '')) save({ description: description.trim() || null });
          }}
        />
      </Field>

      {/* §6 time tracking — stopwatch + manual entries (VIEWER+ can read). */}
      <TimeTracker taskId={task.id} />

      {task.parentId === null && (
        <>
          <Subtasks task={task} canEdit={canEdit} onOpen={openTask} />
          <DependenciesSection task={task} canEdit={canEdit} />
        </>
      )}

      <Separator />
      <TaskComments taskId={task.id} canComment={canEdit} isAdmin={hasRole(role, 'ADMIN')} />
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
            title={t('deleteTitle')}
            description={t('deleteDescription', { title: task.title })}
            confirmLabel={t('delete')}
            onConfirm={() =>
              remove.mutate(task.id, {
                onSuccess: () => {
                  toast.success(t('deleted'));
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
}: {
  task: TaskDetail;
  canEdit: boolean;
  onOpen: (taskId: number) => void;
}) {
  const t = useTranslations('Tasks');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const update = useUpdateTask();
  const create = useCreateTask(task.projectId);
  const [title, setTitle] = useState('');
  const done = task.subtasks.filter((s) => s.status === 'DONE').length;
  const total = task.subtasks.length;

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
                  { taskId: sub.id, input: { status: checked ? 'DONE' : 'TODO' } },
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

/** §2 smart-estimate button — fills the empty estimate field with the AI suggestion. */
function AiEstimateButton({
  projectId,
  title,
  onApply,
}: {
  projectId: number;
  title: string;
  onApply: (hours: number) => void;
}) {
  const t = useTranslations('Ai');
  const toMessage = useErrorMessage();
  const estimate = useAiEstimate(projectId);

  const run = () =>
    estimate.mutate(
      { title },
      {
        onSuccess: (suggestion) => {
          if (suggestion.estimateHours !== null) onApply(suggestion.estimateHours);
          toast.success(
            suggestion.basedOn > 0
              ? t('estimateBasedOn', { count: suggestion.basedOn })
              : (suggestion.rationale || t('estimate')),
            { duration: 6000 },
          );
        },
        onError: (error) => toast.error(toMessage(error)),
      },
    );

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 shrink-0"
      disabled={estimate.isPending}
      onClick={run}
      title={t('estimate')}
    >
      {estimate.isPending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Sparkles aria-hidden className="size-4" />}
      {t('estimate')}
    </Button>
  );
}
