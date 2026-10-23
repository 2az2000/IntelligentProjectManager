'use client';

import { useState } from 'react';
import { Bookmark, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useErrorMessage } from '@/hooks/use-error-message';
import type { SavedViewFilters, ListGroup } from '../api/saved-views.api';
import {
  useDeleteView,
  useSaveView,
  useSavedViews,
  useUpdateView,
} from '../hooks/use-saved-views';
import type { TaskFilters } from '../types';

const NONE = 'none';

/** Drops empty values so the stored JSON stays small and matches the API schema. */
export function toViewFilters(filters: TaskFilters, groupBy: ListGroup): SavedViewFilters {
  return {
    ...(filters.search?.trim() && { search: filters.search.trim() }),
    ...(filters.priority !== undefined && { priority: filters.priority }),
    ...(filters.assigneeId !== undefined && { assigneeId: filters.assigneeId }),
    ...(groupBy !== 'none' && { groupBy }),
  };
}

/**
 * §4 saved views — name the current filter/grouping set, then reopen it in one click.
 * Personal to the caller (the API never lists someone else's views).
 */
export function SavedViewsBar({
  projectId,
  filters,
  groupBy,
  onApply,
}: {
  projectId: number;
  filters: TaskFilters;
  groupBy: ListGroup;
  onApply: (filters: TaskFilters, groupBy: ListGroup) => void;
}) {
  const t = useTranslations('Tasks');
  const tc = useTranslations('Common');
  const toMessage = useErrorMessage();
  const { data: views = [] } = useSavedViews(projectId);
  const save = useSaveView(projectId);
  const update = useUpdateView(projectId);
  const remove = useDeleteView(projectId);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');

  const active = views.find((view) => view.id === activeId) ?? null;

  const apply = (viewId: string) => {
    if (viewId === NONE) {
      setActiveId(null);
      return;
    }
    const view = views.find((candidate) => candidate.id === Number(viewId));
    if (!view) return;
    setActiveId(view.id);
    const { groupBy: savedGroup = 'none', ...savedFilters } = view.filters;
    onApply(savedFilters, savedGroup);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    save.mutate(
      { name: trimmed, filters: toViewFilters(filters, groupBy) },
      {
        onSuccess: (view) => {
          setActiveId(view.id);
          setName('');
          setDialogOpen(false);
          toast.success(t('viewSaved'));
        },
        onError: (error) => toast.error(toMessage(error)),
      },
    );
  };

  const refresh = () => {
    if (!active) return;
    update.mutate(
      { viewId: active.id, filters: toViewFilters(filters, groupBy) },
      {
        onSuccess: () => toast.success(t('viewUpdated')),
        onError: (error) => toast.error(toMessage(error)),
      },
    );
  };

  const destroy = () => {
    if (!active) return;
    remove.mutate(active.id, {
      onSuccess: () => {
        setActiveId(null);
        toast.success(t('viewDeleted'));
      },
      onError: (error) => toast.error(toMessage(error)),
    });
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Bookmark className="size-4 text-muted-foreground" aria-hidden />
      <Select value={active ? String(active.id) : NONE} onValueChange={apply}>
        <SelectTrigger className="w-48" aria-label={t('savedViewsLabel')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('savedViewsNone')}</SelectItem>
          {views.map((view) => (
            <SelectItem key={view.id} value={String(view.id)}>
              {view.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setDialogOpen(true)}>
        <Save className="size-4" aria-hidden />
        {t('saveView')}
      </Button>

      {active && (
        <>
          <Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={update.isPending}>
            {t('updateView')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t('deleteView')}
            onClick={destroy}
            disabled={remove.isPending}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('saveViewTitle')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="saved-view-name">{t('saveViewName')}</Label>
            <Input
              id="saved-view-name"
              value={name}
              maxLength={40}
              placeholder={t('saveViewNamePlaceholder')}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
              {tc('cancel')}
            </Button>
            <Button type="button" onClick={submit} disabled={save.isPending || !name.trim()}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
