'use client';

import { useState } from 'react';
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label as FieldLabel } from '@/components/ui/label';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { cn } from '@/lib/utils';
import { FALLBACK_LABEL_ICON, LABEL_ICON_BY_KEY } from '../lib/label-icons';
import { LABEL_COLORS, LABEL_ICONS, SUGGESTED_LABELS, labelStyle, type Label, type LabelIconKey } from '../types';
import { useCreateLabel, useDeleteLabel, useProjectLabels, useUpdateLabel } from '../hooks/use-labels';

/**
 * The project's label vocabulary: the names, colours and icons the task label field offers.
 * ADMIN-only writes (the server enforces it too); everyone can read.
 */
export function LabelManager({ projectId, canEdit }: { projectId: number; canEdit: boolean }) {
  const t = useTranslations('Labels');
  const { data: labels, isPending } = useProjectLabels(projectId);
  const create = useCreateLabel(projectId);
  const update = useUpdateLabel(projectId);
  const remove = useDeleteLabel(projectId);

  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);
  const [icon, setIcon] = useState<LabelIconKey>('flag');
  const [editing, setEditing] = useState<number | null>(null);

  const busy = create.isPending || update.isPending || remove.isPending;

  const reset = () => {
    setName('');
    setColor(LABEL_COLORS[0]);
    setIcon('flag');
    setEditing(null);
  };

  const submit = () => {
    const value = name.trim();
    if (!value) return;
    if (editing !== null) {
      update.mutate({ labelId: editing, patch: { name: value, color, icon } }, { onSuccess: () => { toast.success(t('updated')); reset(); } });
      return;
    }
    create.mutate({ name: value, color, icon }, { onSuccess: () => { toast.success(t('created')); reset(); } });
  };

  const startEdit = (label: Label) => {
    setEditing(label.id);
    setName(label.name);
    setColor(label.color);
    setIcon(label.icon);
  };

  const addSuggested = async () => {
    const existing = new Set((labels ?? []).map((label) => label.name.toLowerCase()));
    const missing = SUGGESTED_LABELS.filter((label) => !existing.has(label.name.toLowerCase()));
    if (missing.length === 0) {
      toast.info(t('suggestedAllPresent'));
      return;
    }
    // Sequential so a duplicate mid-way doesn't leave a half-applied set behind two requests.
    for (const label of missing) {
      await create.mutateAsync(label).catch(() => undefined);
    }
    toast.success(t('suggestedAdded', { count: missing.length }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isPending ? (
          <TableSkeleton rows={2} />
        ) : (labels ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('empty')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {labels!.map((label) => {
              const Icon = LABEL_ICON_BY_KEY[label.icon] ?? FALLBACK_LABEL_ICON;
              return (
                <li key={label.id} className="flex items-center gap-3 px-3 py-2">
                  <span
                    style={labelStyle(label.color)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border"
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{label.name}</span>
                  {canEdit && (
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label={t('edit')}
                        disabled={busy}
                        onClick={() => startEdit(label)}
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-7"
                        aria-label={t('delete')}
                        disabled={busy}
                        onClick={() =>
                          remove.mutate(label.id, { onSuccess: () => toast.success(t('deleted')) })
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && (
          <div className="flex flex-col gap-3 rounded-md border p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <FieldLabel htmlFor="label-name">{t('name')}</FieldLabel>
                <Input
                  id="label-name"
                  value={name}
                  maxLength={40}
                  placeholder={t('namePlaceholder')}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => event.key === 'Enter' && submit()}
                />
              </div>
              <Button className="gap-1" disabled={!name.trim() || busy} onClick={submit}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : editing !== null ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                {editing !== null ? t('save') : t('add')}
              </Button>
              {editing !== null && (
                <Button variant="ghost" onClick={reset}>
                  {t('cancel')}
                </Button>
              )}
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="sr-only">{t('color')}</legend>
              <div className="flex flex-wrap items-center gap-1.5">
                {LABEL_COLORS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-label={value}
                    aria-pressed={value === color}
                    style={{ backgroundColor: value }}
                    className={cn(
                      'size-6 rounded-full border-2 transition-transform',
                      value === color ? 'scale-110 border-foreground' : 'border-transparent',
                    )}
                    onClick={() => setColor(value)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="sr-only">{t('icon')}</legend>
              <div className="flex flex-wrap items-center gap-1">
                {LABEL_ICONS.map((key) => {
                  const Icon = LABEL_ICON_BY_KEY[key] ?? FALLBACK_LABEL_ICON;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={key}
                      aria-pressed={key === icon}
                      className={cn(
                        'flex size-7 items-center justify-center rounded-md border',
                        key === icon ? 'bg-muted border-foreground' : 'border-transparent hover:bg-muted',
                      )}
                      onClick={() => setIcon(key)}
                    >
                      <Icon className="size-3.5" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <Button variant="outline" size="sm" className="gap-2 self-start" disabled={busy} onClick={addSuggested}>
              <Sparkles className="size-4" aria-hidden />
              {t('addSuggested')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
