'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useMoveTask } from '../hooks/use-tasks';
import { byPosition, planDrop } from '../lib/ordering';
import { TASK_STATUSES, isTaskStatus, type Task, type TaskStatus } from '../types';
import { KanbanColumn } from './kanban-column';
import { TaskCardView } from './task-card';

export function KanbanBoard({
  projectId,
  tasks,
  allTasks,
  readOnly,
  onOpen,
}: {
  projectId: number;
  /** Visible (filtered) tasks. */
  tasks: Task[];
  /** All tasks of the project — used to compute neighbours for ordering. */
  allTasks: Task[];
  readOnly: boolean;
  onOpen: (taskId: number) => void;
}) {
  const t = useTranslations('Tasks');
  const [activeId, setActiveId] = useState<number | null>(null);
  const moveTask = useMoveTask(projectId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columns = useMemo(() => {
    const byStatus = new Map<TaskStatus, Task[]>(TASK_STATUSES.map((s) => [s, []]));
    for (const task of [...tasks].sort(byPosition)) byStatus.get(task.status)?.push(task);
    return byStatus;
  }, [tasks]);

  const titleOf = (id: unknown) => allTasks.find((task) => task.id === id)?.title ?? '';
  const columnOf = (id: unknown) =>
    isTaskStatus(id) ? t(`status.${id}`) : t(`status.${allTasks.find((task) => task.id === id)?.status ?? 'TODO'}`);

  // Screen-reader announcements for keyboard drag & drop.
  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dnd.start', { title: titleOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t('dnd.over', { title: titleOf(active.id), column: columnOf(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over ? t('dnd.end', { title: titleOf(active.id), column: columnOf(over.id) }) : t('dnd.cancel'),
    onDragCancel: () => t('dnd.cancel'),
  };

  const activeTask = activeId != null ? allTasks.find((task) => task.id === activeId) : undefined;

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(typeof active.id === 'number' ? active.id : null);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || typeof active.id !== 'number') return;

    // Dropped on a column (id = status) or on a card (carries its status in data).
    const overStatus: unknown = over.data.current?.status;
    const target = isTaskStatus(over.id) ? over.id : isTaskStatus(overStatus) ? overStatus : null;
    if (!target) return;
    const overTaskId = typeof over.id === 'number' ? over.id : undefined;

    const plan = planDrop(allTasks, active.id, target, overTaskId);
    if (!plan) return;
    moveTask.mutate({ taskId: active.id, plan }, { onError: () => toast.error(t('moveFailed')) });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{ announcements }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-4">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            projectId={projectId}
            status={status}
            tasks={columns.get(status) ?? []}
            readOnly={readOnly}
            onOpen={onOpen}
          />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCardView task={activeTask} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
