'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import {
  useCreateStatus,
  useDeleteStatus,
  useProjectStatuses,
  useReorderStatuses,
  useUpdateStatus,
} from '../hooks/use-statuses';
import { FALLBACK_STATUSES, sortStatuses } from '../lib/statuses';
import { STATUS_CATEGORIES, STATUS_COLORS, statusStyle, type ProjectStatus, type StatusCategory } from '../types';

/**
 * §7 the project's workflow columns: add a column of your own (QA, Release, Blocked…), say where
 * it sits and which analytics bucket it counts as. ADMIN-only — the API enforces it too.
 */
export function StatusManager({ projectId, canEdit }: { projectId: number; canEdit: boolean }) {
  const t = useTranslations('Statuses');
  const { data, isPending } = useProjectStatuses(projectId);
  const statuses = sortStatuses(data ?? FALLBACK_STATUSES);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{canEdit ? t('description') : t('readOnlyHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPending ? (
          <TableSkeleton rows={4} />
        ) : (
          <ul className="divide-y">
            {statuses.map((status, index) => (
              <StatusRow
                key={status.key}
                projectId={projectId}
                status={status}
                statuses={statuses}
                index={index}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
        {canEdit && <AddStatus projectId={projectId} statuses={statuses} />}
      </CardContent>
    </Card>
  );
}

function StatusRow({
  projectId,
  status,
  statuses,
  index,
  canEdit,
}: {
  projectId: number;
  status: ProjectStatus;
  statuses: ProjectStatus[];
  index: number;
  canEdit: boolean;
}) {
  const t = useTranslations('Statuses');
  const tc = useTranslations('Tasks.status');
  const update = useUpdateStatus(projectId);
  const reorder = useReorderStatuses(projectId);
  const [label, setLabel] = useState(tc.has(status.key) ? tc(status.key) : status.label);
  const builtin = tc.has(status.key);
  const others = statuses.filter((s) => s.key !== status.key);

  /** Swaps this column with its neighbour and rewrites the full order (the API wants all keys). */
  const move = (delta: -1 | 1) => {
    const keys = statuses.map((s) => s.key);
    const target = index + delta;
    if (target < 0 || target >= keys.length) return;
    [keys[index], keys[target]] = [keys[target]!, keys[index]!];
    reorder.mutate(keys, { onSuccess: () => toast.success(t('reordered')) });
  };

  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <span
        aria-hidden
        className="h-8 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: status.color }}
      />
      <Input
        value={label}
        aria-label={t('label')}
        className="h-8 w-44"
        disabled={!canEdit || builtin}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => {
          const next = label.trim();
          if (!next || next === status.label) {
            setLabel(tc.has(status.key) ? tc(status.key) : status.label);
            return;
          }
          // A built-in keeps its key (and its translation) — only custom columns take a new label.
          update.mutate({ statusId: status.id, patch: { label: next } });
        }}
      />
      {builtin && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {t('builtin')}
        </span>
      )}

      <input
        type="color"
        aria-label={t('color')}
        value={status.color}
        disabled={!canEdit}
        className="h-8 w-8 cursor-pointer rounded border bg-transparent p-0.5 disabled:opacity-50"
        onChange={(e) => update.mutate({ statusId: status.id, patch: { color: e.target.value } })}
      />

      <Select
        value={status.category}
        disabled={!canEdit}
        onValueChange={(value) =>
          update.mutate(
            { statusId: status.id, patch: { category: value as StatusCategory } },
            { onSuccess: () => toast.success(t('categorySaved')) },
          )
        }
      >
        <SelectTrigger className="w-40" aria-label={t('category')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_CATEGORIES.map((category) => (
            <SelectItem key={category} value={category}>
              {t(`categories.${category}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {canEdit && (
        <div className="ms-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('moveUp')}
            disabled={index === 0 || reorder.isPending}
            onClick={() => move(-1)}
          >
            <ArrowUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('moveDown')}
            disabled={index === statuses.length - 1 || reorder.isPending}
            onClick={() => move(1)}
          >
            <ArrowDown className="size-4" />
          </Button>
          <DeleteStatus
            projectId={projectId}
            status={status}
            others={others}
            disabled={statuses.length <= 1}
          />
        </div>
      )}
    </li>
  );
}

/** Deleting a column that still holds tasks must say where they go — the API refuses otherwise. */
function DeleteStatus({
  projectId,
  status,
  others,
  disabled,
}: {
  projectId: number;
  status: ProjectStatus;
  others: ProjectStatus[];
  disabled: boolean;
}) {
  const t = useTranslations('Statuses');
  const tc = useTranslations('Tasks.status');
  const remove = useDeleteStatus(projectId);
  const [moveToKey, setMoveToKey] = useState(others[0]?.key ?? '');

  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive"
          aria-label={t('delete')}
          disabled={disabled}
        >
          <Trash2 className="size-4" />
        </Button>
      }
      title={t('deleteTitle', { name: tc.has(status.key) ? tc(status.key) : status.label })}
      description={
        <span className="flex flex-col gap-2">
          {t('deleteDescription')}
          <Select value={moveToKey} onValueChange={setMoveToKey}>
            <SelectTrigger className="w-full" aria-label={t('moveTo')}>
              <SelectValue placeholder={t('moveTo')} />
            </SelectTrigger>
            <SelectContent>
              {others.map((other) => (
                <SelectItem key={other.key} value={other.key}>
                  {tc.has(other.key) ? tc(other.key) : other.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      }
      confirmLabel={t('delete')}
      onConfirm={() =>
        remove.mutate(
          { statusId: status.id, moveToKey },
          { onSuccess: () => toast.success(t('deleted')) },
        )
      }
    />
  );
}

function AddStatus({ projectId, statuses }: { projectId: number; statuses: ProjectStatus[] }) {
  const t = useTranslations('Statuses');
  const create = useCreateStatus(projectId);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState<string>(STATUS_COLORS[5]);
  const [category, setCategory] = useState<StatusCategory>('IN_PROGRESS');
  const [afterKey, setAfterKey] = useState<string>(statuses.at(-1)?.key ?? '');

  const add = () => {
    const value = label.trim();
    if (!value) return;
    create.mutate(
      { label: value, color, category, ...(afterKey ? { afterKey } : {}) },
      {
        onSuccess: () => {
          toast.success(t('created'));
          setLabel('');
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={label}
          placeholder={t('labelPlaceholder')}
          aria-label={t('label')}
          className="h-9 w-40"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input
          type="color"
          aria-label={t('color')}
          value={color}
          className="h-9 w-9 cursor-pointer rounded border bg-transparent p-0.5"
          onChange={(e) => setColor(e.target.value)}
        />
        <Select value={category} onValueChange={(v) => setCategory(v as StatusCategory)}>
          <SelectTrigger className="w-40" aria-label={t('category')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_CATEGORIES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`categories.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={afterKey} onValueChange={setAfterKey}>
          <SelectTrigger className="w-48" aria-label={t('afterLabel')}>
            <SelectValue placeholder={t('afterEnd')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('afterEnd')}</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status.key} value={status.key}>
                {t('after', { name: status.label })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          className="gap-1"
          disabled={!label.trim() || create.isPending}
          onClick={add}
        >
          <Plus className="size-4" aria-hidden />
          {t('add')}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('hint')}</p>
      <div className="flex flex-wrap gap-1">
        {STATUS_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={swatch}
            aria-pressed={color === swatch}
            onClick={() => setColor(swatch)}
            className="size-5 rounded-full border"
            style={{ ...statusStyle(swatch), backgroundColor: swatch }}
          />
        ))}
      </div>
    </div>
  );
}
