'use client';

import { useState } from 'react';
import { ListTodo } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { BoardSkeleton, TableSkeleton } from '@/components/shared/loading-skeletons';
import { hasRole, useProject, useProjectMembers } from '@/features/projects';
import { PresenceAvatars, useProjectSocket } from '@/features/realtime';
import { useProjectTasks } from '../hooks/use-tasks';
import { useTaskSheet } from '../hooks/use-task-sheet';
import type { TaskFilters } from '../types';
import { BoardFilters, applyFilters } from './board-filters';
import { CreateTaskDialog } from './create-task-dialog';
import { KanbanBoard } from './kanban-board';
import { TaskTable } from './task-table';

/** Board or list view of a project's tasks, with shared filters. */
export function ProjectTasks({ projectId, view }: { projectId: number; view: 'board' | 'list' }) {
  const t = useTranslations('Tasks');
  const { openTask } = useTaskSheet();
  const [filters, setFilters] = useState<TaskFilters>({});
  const { data: project } = useProject(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: tasks, isPending, isError, error, refetch } = useProjectTasks(projectId);

  const canEdit = !!project && hasRole(project.myRole, 'MEMBER');
  const people = members.map((m) => m.user);
  const assignable = members.filter((m) => hasRole(m.role, 'MEMBER')).map((m) => m.user);

  // Live updates + the "who is online" indicator for this project room.
  useProjectSocket(projectId);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  const visible = tasks ? applyFilters(tasks, filters) : [];

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <BoardFilters filters={filters} onChange={setFilters} members={people} />
        <div className="flex items-center gap-2">
          <PresenceAvatars projectId={projectId} />
          {canEdit && <CreateTaskDialog projectId={projectId} members={assignable} />}
        </div>
      </div>

      {isPending ? (
        view === 'board' ? <BoardSkeleton /> : <TableSkeleton />
      ) : view === 'board' ? (
        <KanbanBoard
          projectId={projectId}
          tasks={visible}
          allTasks={tasks}
          readOnly={!canEdit}
          onOpen={openTask}
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={ListTodo} title={t('empty')} />
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <TaskTable tasks={visible} onOpen={openTask} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
