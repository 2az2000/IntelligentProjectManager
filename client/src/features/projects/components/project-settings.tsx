'use client';

import { useState } from 'react';
import { ArchiveRestore, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useRouter } from '@/i18n/navigation';
import { ProjectDocCard, SemanticIndexCard, WeeklySummaryCard } from '@/features/ai';
import { LabelManager } from '@/features/labels';
import { StatusManager, sortStatuses, useProjectStatuses } from '@/features/statuses';
import { useRestoreTask, useTrashTasks } from '@/features/tasks';
import { formatNumber } from '@/lib/format';
import { useDeleteProject, useProject, useUpdateProject } from '../hooks/use-projects';
import { hasRole } from '../types';
import { ProjectForm } from './project-form';
import { ProjectMembers } from './project-members';

export function ProjectSettings({ projectId }: { projectId: number }) {
  const t = useTranslations('Projects');
  const toMessage = useErrorMessage();
  const router = useRouter();
  const { data: project, isPending, isError, error, refetch } = useProject(projectId);
  const update = useUpdateProject(projectId);
  const remove = useDeleteProject();

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isPending) return <TableSkeleton />;

  const canEdit = hasRole(project.myRole, 'ADMIN');

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('generalTitle')}</CardTitle>
          <CardDescription>{canEdit ? t('generalDescription') : t('readOnlyHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectForm
            key={project.updatedAt}
            initial={project}
            disabled={!canEdit}
            submitLabel={t('save')}
            pending={update.isPending}
            onSubmit={(input) =>
              update.mutate(input, {
                onSuccess: () => toast.success(t('saved')),
                onError: (e) => toast.error(toMessage(e)),
              })
            }
          />
        </CardContent>
      </Card>

      <ProjectMembers project={project} />

      <LabelManager projectId={project.id} canEdit={canEdit} />

      {/* §7 the project's own workflow columns — add QA/Release and place them where they belong. */}
      <StatusManager projectId={project.id} canEdit={canEdit} />

      <WipLimitsCard projectId={project.id} limits={project.columnLimits} canEdit={canEdit} />

      <ProjectDocCard projectId={project.id} />

      <WeeklySummaryCard projectId={project.id} />

      <SemanticIndexCard projectId={project.id} />

      <TrashCard projectId={project.id} canRestore={canEdit} />

      {project.myRole === 'OWNER' && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">{t('dangerTitle')}</CardTitle>
            <CardDescription>{t('deleteDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmDialog
              trigger={
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="size-4" aria-hidden />
                  {t('delete')}
                </Button>
              }
              title={t('deleteTitle', { name: project.name })}
              description={t('deleteConfirm')}
              confirmLabel={t('delete')}
              onConfirm={() =>
                remove.mutate(project.id, {
                  onSuccess: () => {
                    toast.success(t('deleted'));
                    router.replace('/app/projects');
                  },
                  onError: (e) => toast.error(toMessage(e)),
                })
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * §4 WIP limits: per-column caps, saved immediately. Zero/blank means "no limit", so the map only
 * carries real caps and an empty map clears the field on the server.
 */
function WipLimitsCard({
  projectId,
  limits,
  canEdit,
}: {
  projectId: number;
  limits: Record<string, number> | null;
  canEdit: boolean;
}) {
  const t = useTranslations('Projects');
  const ts = useTranslations('Tasks.status');
  const toMessage = useErrorMessage();
  const update = useUpdateProject(projectId);
  const { data: projectStatuses } = useProjectStatuses(projectId);
  const statuses = sortStatuses(projectStatuses ?? []);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const valueOf = (key: string) => draft[key] ?? limits?.[key]?.toString() ?? '';

  const commit = () => {
    const next: Record<string, number> = {};
    for (const status of statuses) {
      const raw = valueOf(status.key).trim();
      const parsed = Number(raw);
      if (raw !== '' && Number.isInteger(parsed) && parsed > 0) next[status.key] = parsed;
    }
    const unchanged =
      JSON.stringify(next) === JSON.stringify(limits ?? {}) ||
      (Object.keys(next).length === 0 && limits === null);
    if (unchanged) return;
    update.mutate(
      { columnLimits: Object.keys(next).length ? next : null },
      { onSuccess: () => toast.success(t('wipSaved')), onError: (error) => toast.error(toMessage(error)) },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('wipTitle')}</CardTitle>
        <CardDescription>{t('wipDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {statuses.map((status) => (
          <div key={status.key} className="flex items-center justify-between gap-4">
            <Label htmlFor={`wip-${status.key}`} className="flex-1">
              {ts.has(status.key) ? ts(status.key) : status.label}
            </Label>
            <Input
              id={`wip-${status.key}`}
              type="number"
              min={1}
              max={200}
              inputMode="numeric"
              className="w-24"
              placeholder={t('wipUnlimited')}
              disabled={!canEdit || update.isPending}
              value={valueOf(status.key)}
              onChange={(event) => setDraft((current) => ({ ...current, [status.key]: event.target.value }))}
              onBlur={commit}
              onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** §11 recycling bin: soft-deleted tasks with one-click restore. */
function TrashCard({ projectId, canRestore }: { projectId: number; canRestore: boolean }) {
  const t = useTranslations('Projects');
  const tt = useTranslations('Tasks');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { data: trash, isPending } = useTrashTasks(projectId);
  const restore = useRestoreTask(projectId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('trashTitle')}</CardTitle>
        <CardDescription>{t('trashDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <TableSkeleton rows={1} />
        ) : !trash || trash.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('trashEmpty')}</p>
        ) : (
          <ul className="divide-y">
            {trash.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {tt('subtask', { count: formatNumber(task.subtaskCount, locale) })}
                  </p>
                </div>
                {canRestore && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    disabled={restore.isPending}
                    onClick={() =>
                      restore.mutate(task.id, {
                        onSuccess: () => toast.success(t('trashRestored')),
                        onError: (e) => toast.error(toMessage(e)),
                      })
                    }
                  >
                    <ArchiveRestore className="size-4" aria-hidden />
                    {t('trashRestore')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
