'use client';

import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useRouter } from '@/i18n/navigation';
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
                    router.replace('/projects');
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
