'use client';

import { FolderKanban } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { CardGridSkeleton } from '@/components/shared/loading-skeletons';
import { useProjects } from '../hooks/use-projects';
import { CreateProjectDialog } from './create-project-dialog';
import { ProjectCard } from './project-card';

export function ProjectGrid() {
  const t = useTranslations('Projects');
  const { data: projects, isPending, isError, error, refetch } = useProjects();

  if (isPending) return <CardGridSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (projects.length === 0) {
    return (
      <EmptyState
        icon={FolderKanban}
        title={t('empty')}
        description={t('emptyDescription')}
        action={<CreateProjectDialog />}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
