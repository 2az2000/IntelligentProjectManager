'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useProjectTasks } from '@/features/tasks/hooks/use-tasks';
import type { TaskDetail } from '@/features/tasks/types';
import { useCreateDependency, useDeleteDependency, useDependencies } from '../hooks/use-schedule';
import type { DependencyView } from '../types';

/**
 * "Depends on / blocks" editor for a top-level task. The server rejects
 * self-links, cross-project links and cycles — we surface those as toasts.
 */
export function DependenciesSection({ task, canEdit }: { task: TaskDetail; canEdit: boolean }) {
  const t = useTranslations('Scheduling');
  const toMessage = useErrorMessage();
  const { data: dependencies = [] } = useDependencies(task.projectId);
  const { data: tasks = [] } = useProjectTasks(task.projectId);
  const create = useCreateDependency(task.projectId);
  const remove = useDeleteDependency(task.projectId);

  const dependsOn = dependencies.filter((d) => d.successorId === task.id);
  const blocks = dependencies.filter((d) => d.predecessorId === task.id);
  const linked = new Set([
    ...dependsOn.map((d) => d.predecessorId),
    ...blocks.map((d) => d.successorId),
  ]);
  const candidates = tasks.filter((x) => x.id !== task.id && !linked.has(x.id));

  const add = (direction: 'dependsOn' | 'blocks', otherId: number) =>
    create.mutate(
      direction === 'dependsOn'
        ? { predecessorId: otherId, successorId: task.id }
        : { predecessorId: task.id, successorId: otherId },
      { onError: (error) => toast.error(toMessage(error)) },
    );

  const removeDep = (dependency: DependencyView) =>
    remove.mutate(
      { predecessorId: dependency.predecessorId, successorId: dependency.successorId },
      { onError: (error) => toast.error(toMessage(error)) },
    );

  return (
    <section className="flex flex-col gap-3" aria-label={t('dependencies')}>
      <h3 className="text-sm font-semibold">{t('dependencies')}</h3>

      {dependsOn.length === 0 && blocks.length === 0 && (
        <p className="text-xs text-muted-foreground">{t('emptyDependencies')}</p>
      )}

      <DependencyGroup
        direction="dependsOn"
        label={t('dependsOn')}
        dependencies={dependsOn}
        tasks={tasks}
        candidates={candidates}
        canEdit={canEdit}
        placeholder={t('addPlaceholder')}
        onAdd={(otherId) => add('dependsOn', otherId)}
        onRemove={removeDep}
      />
      <DependencyGroup
        direction="blocks"
        label={t('blocks')}
        dependencies={blocks}
        tasks={tasks}
        candidates={candidates}
        canEdit={canEdit}
        placeholder={t('addPlaceholder')}
        onAdd={(otherId) => add('blocks', otherId)}
        onRemove={removeDep}
      />
    </section>
  );
}

interface TaskLike {
  id: number;
  title: string;
}

function DependencyGroup({
  direction,
  label,
  dependencies,
  tasks,
  candidates,
  canEdit,
  placeholder,
  onAdd,
  onRemove,
}: {
  direction: 'dependsOn' | 'blocks';
  label: string;
  /** For "dependsOn" the other task is the predecessor; for "blocks" the successor. */
  dependencies: DependencyView[];
  tasks: TaskLike[];
  candidates: TaskLike[];
  canEdit: boolean;
  placeholder: string;
  onAdd: (otherId: number) => void;
  onRemove: (dependency: DependencyView) => void;
}) {
  const otherIdOf = (d: DependencyView) =>
    direction === 'dependsOn' ? d.predecessorId : d.successorId;
  const titleOf = (id: number) => tasks.find((x) => x.id === id)?.title ?? `#${id}`;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {dependencies.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {dependencies.map((d) => {
            const otherId = otherIdOf(d);
            return (
              <li key={`${d.predecessorId}-${d.successorId}`}>
                <Badge variant="secondary" className="gap-1 pe-1 font-normal">
                  <span dir="auto" className="max-w-40 truncate" title={titleOf(otherId)}>
                    {titleOf(otherId)}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`${label}: ${titleOf(otherId)}`}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      onClick={() => onRemove(d)}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  )}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      {canEdit && (
        <Select
          value=""
          onValueChange={(value) => value && onAdd(Number(value))}
          disabled={candidates.length === 0}
        >
          <SelectTrigger className="h-8 text-xs" aria-label={label}>
            <SelectValue placeholder={candidates.length === 0 ? placeholder : label} />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                <span dir="auto" className="max-w-64 truncate">
                  {c.title}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
