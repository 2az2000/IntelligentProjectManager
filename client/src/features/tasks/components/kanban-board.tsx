'use client';

import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectLabels } from '@/features/labels';
import { sortStatuses, type ProjectStatus } from '@/features/statuses';
import { useMoveTask } from '../hooks/use-tasks';
import { byPosition, planDrop, planDropAtIndex, type DropPlan } from '../lib/ordering';
import type { Task } from '../types';
import { KanbanColumn } from './kanban-column';
import { TaskCardView } from './task-card';

/** Where the dragged card currently *would* land while the pointer is moving. */
interface Preview {
  statusKey: string;
  index: number;
}

/**
 * A card keeps its slot in the column as a *live* droppable while it is dragged, so a purely
 * geometric comparison (`closestCorners`) can hand the drop straight back to that slot: the card
 * then never leaves its column and the drop silently becomes a no-op. Resolve from the pointer
 * instead — a different card under the pointer wins (precise placement), otherwise the column
 * under it does (append). Keyboard drags may carry no pointer, so they keep the corner fallback.
 */
const boardCollisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  if (within.length === 0) return closestCorners(args);

  const card = within.find(
    (collision) => typeof collision.id === 'number' && collision.id !== args.active.id,
  );
  if (card) return [card];

  // Columns are keyed by name, cards by task id — so the remaining string candidate is the column
  // that encloses the pointer (it is the only one that can contain it).
  const column = within.find((collision) => typeof collision.id === 'string');
  return column ? [column] : [within[0]!];
};

export function KanbanBoard({
  projectId,
  statuses,
  tasks,
  allTasks,
  readOnly,
  onOpen,
  columnLimits,
}: {
  projectId: number;
  /** The project's workflow columns, in board order — they *are* the board. */
  statuses: ProjectStatus[];
  /** Visible (filtered) tasks. */
  tasks: Task[];
  /** All tasks of the project — used to compute neighbours for ordering. */
  allTasks: Task[];
  readOnly: boolean;
  onOpen: (taskId: number) => void;
  /** §4 WIP limits per column (`{ IN_PROGRESS: 5 }`); a full column asks before accepting a card. */
  columnLimits?: Record<string, number> | null;
}) {
  const t = useTranslations('Tasks');
  const ts = useTranslations('Tasks.status');
  const { data: labels } = useProjectLabels(projectId);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // A drop that would push a limited column over its WIP limit waits here for confirmation.
  const [pending, setPending] = useState<{ taskId: number; plan: DropPlan; column: string; limit: number } | null>(null);
  const moveTask = useMoveTask(projectId);

  const columns = useMemo(() => sortStatuses(statuses), [statuses]);
  const keyOf = (index: number) => columns[index]?.key ?? '';

  const sensors = useSensors(
    // A few pixels of slop keeps a click on a card a click, not a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch needs a short hold: otherwise a scroll gesture picks a card up by accident.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** The column a card is (or would be) in — its own key, or the column it hovers over. */
  const targetKeyOf = (over: DragOverEvent['over']): string | null => {
    if (!over) return null;
    if (typeof over.id === 'string' && columns.some((status) => status.key === over.id)) {
      return over.id;
    }
    const data = over.data.current?.statusKey;
    return typeof data === 'string' ? data : null;
  };

  /**
   * Columns as the user should see them *right now*: the server order, with the dragged card
   * moved into its preview slot. Rendering the preview (instead of snapping on drop) is what
   * makes a cross-column drag look continuous.
   */
  const grouped = useMemo(() => {
    const byKey = new Map<string, Task[]>(columns.map((status) => [status.key, []]));
    for (const task of [...tasks].sort(byPosition)) {
      // A task whose column was deleted mid-session still has to be visible somewhere.
      const bucket = byKey.get(task.statusKey) ?? byKey.get(columns[0]?.key ?? '');
      bucket?.push(task);
    }

    if (activeId === null || preview === null) return byKey;
    const active = tasks.find((task) => task.id === activeId);
    if (!active) return byKey;

    for (const list of byKey.values()) {
      const at = list.findIndex((task) => task.id === activeId);
      if (at >= 0) list.splice(at, 1);
    }
    const target = byKey.get(preview.statusKey);
    if (target) {
      target.splice(Math.min(Math.max(preview.index, 0), target.length), 0, {
        ...active,
        statusKey: preview.statusKey,
      });
    }
    return byKey;
  }, [columns, tasks, activeId, preview]);

  const labelOf = (key: string) => {
    const status = columns.find((column) => column.key === key);
    return status && ts.has(key) ? ts(key) : (status?.label ?? key);
  };

  const titleOf = (id: UniqueIdentifier) => allTasks.find((task) => task.id === id)?.title ?? '';
  const columnOf = (id: UniqueIdentifier) => {
    if (typeof id === 'string' && columns.some((status) => status.key === id)) return labelOf(id);
    const task = allTasks.find((candidate) => candidate.id === id);
    return labelOf(task?.statusKey ?? keyOf(0));
  };

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
    if (typeof active.id !== 'number') return;
    const own = tasks.find((task) => task.id === active.id);
    setActiveId(active.id);
    setPreview(
      own === undefined
        ? null
        : {
            statusKey: own.statusKey,
            index: tasks
              .filter((task) => task.statusKey === own.statusKey)
              .sort(byPosition)
              .findIndex((task) => task.id === active.id),
          },
    );
  };

  /** The cards of a column that stay put — the list every drop plan reasons about. */
  const restOf = (statusKey: string) =>
    (grouped.get(statusKey) ?? []).filter((task) => task.id !== activeId);

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || typeof active.id !== 'number') return;
    const statusKey = targetKeyOf(over);
    if (!statusKey) return;
    const overId = over.id;

    // Over another card: land on the side the card is moving towards.
    if (typeof overId === 'number' && overId !== active.id) {
      const rest = restOf(statusKey);
      const overIndex = rest.findIndex((task) => task.id === overId);
      if (overIndex >= 0) {
        const sameColumn = tasks.find((task) => task.id === active.id)?.statusKey === statusKey;
        const ownColumn = tasks.filter((task) => task.statusKey === statusKey).sort(byPosition);
        const movingDown =
          sameColumn &&
          ownColumn.findIndex((task) => task.id === active.id) <
            ownColumn.findIndex((task) => task.id === overId);
        const index = movingDown ? overIndex + 1 : overIndex;
        setPreview((current) =>
          current && current.statusKey === statusKey && current.index === index
            ? current
            : { statusKey, index },
        );
        return;
      }
    }

    // Over the column surface — which is also where the dragged card's own slot sits, so this is
    // the common case. Land at the end when entering the column, but never shove a preview that is
    // already here down to the end: that would make the card jump away from the pointer.
    setPreview((current) =>
      current && current.statusKey === statusKey
        ? current
        : { statusKey, index: restOf(statusKey).length },
    );
  };

  /** Runs a move and offers a one-click undo back to the card's previous slot. */
  const runMove = (
    taskId: number,
    plan: DropPlan,
    previous?: { statusKey: string; index: number },
  ) => {
    moveTask.mutate(
      { taskId, plan },
      {
        onError: () => toast.error(t('moveFailed')),
        onSuccess: () => {
          if (!previous) return;
          const undo = planDropAtIndex(allTasks, taskId, previous.statusKey, previous.index);
          if (!undo) return;
          toast.success(t('moved'), {
            action: {
              label: t('undo'),
              onClick: () =>
                moveTask.mutate(
                  { taskId, plan: undo },
                  { onError: () => toast.error(t('moveFailed')) },
                ),
            },
          });
        },
      },
    );
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    // What the user actually saw is the source of truth: the pointer sits on the dragged card's own
    // slot at drop time, so the collision often resolves to the column rather than a neighbour.
    const dropped = preview;
    setActiveId(null);
    setPreview(null);
    if (typeof active.id !== 'number') return;

    const target = over ? targetKeyOf(over) : null;
    const overTaskId =
      over && typeof over.id === 'number' && over.id !== active.id ? over.id : undefined;

    const plan =
      target && overTaskId !== undefined
        ? planDrop(allTasks, active.id, target, overTaskId)
        : dropped
          ? planDropAtIndex(allTasks, active.id, dropped.statusKey, dropped.index)
          : null;
    if (!plan) return;

    const previousTask = allTasks.find((task) => task.id === active.id);
    const previous = previousTask
      ? {
          statusKey: previousTask.statusKey,
          index: allTasks
            .filter((task) => task.statusKey === previousTask.statusKey)
            .sort(byPosition)
            .findIndex((task) => task.id === active.id),
        }
      : undefined;

    // §4 WIP limit: crossing into a full column is a conscious choice, never a silent overflow.
    const limit = columnLimits?.[plan.statusKey];
    const wouldOverflow =
      limit !== undefined &&
      previousTask !== undefined &&
      previousTask.statusKey !== plan.statusKey &&
      allTasks.filter((task) => task.statusKey === plan.statusKey && task.id !== active.id).length >=
        limit;
    if (wouldOverflow) {
      setPending({ taskId: active.id, plan, column: labelOf(plan.statusKey), limit: limit! });
      return;
    }

    runMove(active.id, plan, previous);
  };

  const reset = () => {
    setActiveId(null);
    setPreview(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      accessibility={{ announcements }}
      // Columns resize as cards move between them, so re-measure on every frame of the drag.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={reset}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-4" data-tour="board">
        {columns.map((status) => (
          <KanbanColumn
            key={status.key}
            projectId={projectId}
            status={status}
            tasks={grouped.get(status.key) ?? []}
            labels={labels}
            readOnly={readOnly}
            onOpen={onOpen}
            limit={columnLimits?.[status.key]}
          />
        ))}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('wipTitle', { column: pending?.column ?? '' })}</DialogTitle>
            <DialogDescription>
              {t('wipBody', { limit: pending?.limit ?? 0 })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              {t('wipCancel')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!pending) return;
                const { taskId, plan } = pending;
                const previousTask = allTasks.find((task) => task.id === taskId);
                setPending(null);
                runMove(
                  taskId,
                  plan,
                  previousTask
                    ? {
                        statusKey: previousTask.statusKey,
                        index: allTasks
                          .filter((task) => task.statusKey === previousTask.statusKey)
                          .sort(byPosition)
                          .findIndex((task) => task.id === taskId),
                      }
                    : undefined,
                );
              }}
            >
              {t('wipConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DragOverlay
        // Settle the card into its slot instead of teleporting it on drop.
        dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      >
        {activeTask ? <TaskCardView task={activeTask} labels={labels} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
