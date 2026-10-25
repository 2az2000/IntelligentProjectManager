'use client';

import { useCallback, useState } from 'react';
import { Keyboard, ListTodo, Rows3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { BoardSkeleton, TableSkeleton } from '@/components/shared/loading-skeletons';
import { hasRole, useProject, useProjectMembers } from '@/features/projects';
import { BreakdownDialog, ProjectChat } from '@/features/ai';
import { PresenceAvatars, useProjectSocket } from '@/features/realtime';
import { FALLBACK_STATUSES, sortStatuses, useProjectStatuses } from '@/features/statuses';
import { ProductTour } from '@/features/onboarding';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useProjectTasks, useUpdateTask } from '../hooks/use-tasks';
import { useTaskSheet } from '../hooks/use-task-sheet';
import { useTaskShortcuts } from '../hooks/use-task-shortcuts';
import type { ListGroup } from '../api/saved-views.api';
import type { TaskFilters } from '../types';
import { BoardFilters, applyFilters } from './board-filters';
import { CreateTaskDialog } from './create-task-dialog';
import { KanbanBoard } from './kanban-board';
import { SavedViewsBar } from './saved-views';
import { TaskShortcutsHelp } from './task-shortcuts-help';
import { TaskTable } from './task-table';

/** Board or list view of a project's tasks, with shared filters. */
export function ProjectTasks({ projectId, view }: { projectId: number; view: 'board' | 'list' }) {
  const t = useTranslations('Tasks');
  const { openTask } = useTaskSheet();
  const toMessage = useErrorMessage();
  const [filters, setFilters] = useState<TaskFilters>({});
  const [groupBy, setGroupBy] = useState<ListGroup>('none');
  const [helpOpen, setHelpOpen] = useState(false);
  const update = useUpdateTask();
  const { data: project } = useProject(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: tasks, isPending, isError, error, refetch } = useProjectTasks(projectId);
  // The board's columns are the project's own statuses; the fallback keeps it renderable meanwhile.
  const { data: projectStatuses } = useProjectStatuses(projectId);
  const statuses = projectStatuses ?? FALLBACK_STATUSES;

  const canEdit = !!project && hasRole(project.myRole, 'MEMBER');
  const people = members.map((m) => m.user);
  const assignable = members.filter((m) => hasRole(m.role, 'MEMBER')).map((m) => m.user);

  const patch = useCallback(
    (taskId: number, input: Parameters<typeof update.mutate>[0]['input']) =>
      update.mutate({ taskId, input }, { onError: (error) => toast.error(toMessage(error)) }),
    [update, toMessage],
  );

  // `1–4` on a focused card/row moves it to that workflow column (board order).
  const onShortcutStatus = useCallback(
    (taskId: number, slot: 1 | 2 | 3 | 4) => {
      const status = sortStatuses(statuses)[slot - 1];
      if (status) patch(taskId, { statusKey: status.key });
    },
    [statuses, patch],
  );
  useTaskShortcuts({ canEdit, onStatus: onShortcutStatus, onHelp: () => setHelpOpen(true) });

  // Live updates + the "who is online" indicator for this project room.
  useProjectSocket(projectId);

  if (isError) return <ErrorState error={error} onRetry={() => refetch()} />;

  const visible = tasks ? applyFilters(tasks, filters) : [];

  return (
    <div className="flex flex-1 flex-col">
      <SavedViewsBar
        projectId={projectId}
        filters={filters}
        groupBy={groupBy}
        onApply={(nextFilters, nextGroup) => {
          setFilters(nextFilters);
          setGroupBy(nextGroup);
        }}
      />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <BoardFilters filters={filters} onChange={setFilters} members={people} />
          {view === 'list' && (
            <div className="mb-4 flex items-center gap-2">
              <Rows3 className="size-4 text-muted-foreground" aria-hidden />
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as ListGroup)}>
                <SelectTrigger className="w-44" aria-label={t('groupByLabel')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('groupNone')}</SelectItem>
                  <SelectItem value="assignee">{t('groupAssignee')}</SelectItem>
                  <SelectItem value="priority">{t('groupPriority')}</SelectItem>
                  <SelectItem value="status">{t('groupStatus')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PresenceAvatars projectId={projectId} />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            data-tour="shortcuts"
            aria-label={t('shortcutsTitle')}
            onClick={() => setHelpOpen(true)}
          >
            <Keyboard className="size-4" aria-hidden />
          </Button>
          <ProjectChat projectId={projectId} compact />
          {canEdit && <BreakdownDialog projectId={projectId} />}
          {canEdit && (
            <div data-tour="new-task">
              <CreateTaskDialog projectId={projectId} members={assignable} statuses={statuses} />
            </div>
          )}
        </div>
      </div>

      {isPending ? (
        view === 'board' ? <BoardSkeleton /> : <TableSkeleton />
      ) : view === 'board' ? (
        <KanbanBoard
          projectId={projectId}
          statuses={statuses}
          tasks={visible}
          allTasks={tasks}
          readOnly={!canEdit}
          onOpen={openTask}
          columnLimits={project?.columnLimits}
        />
      ) : visible.length === 0 ? (
        <EmptyState icon={ListTodo} title={t('empty')} />
      ) : (
        <Card className="py-0">
          <CardContent className="p-0">
            <TaskTable
              tasks={visible}
              statuses={statuses}
              onOpen={openTask}
              projectId={canEdit ? projectId : undefined}
              groupBy={groupBy}
              onPatch={canEdit ? patch : undefined}
            />
          </CardContent>
        </Card>
      )}

      <TaskShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />
      <ProductTour />
    </div>
  );
}
