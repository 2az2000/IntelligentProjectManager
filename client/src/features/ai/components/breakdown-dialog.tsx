'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useErrorMessage } from '@/hooks/use-error-message';
import { qk } from '@/lib/query-keys';
import { taskApi } from '@/features/tasks/api/task.api';
import { schedulingApi } from '@/features/scheduling/api/scheduling.api';
import { useBreakdown } from '../hooks/use-ai';
import type { BreakdownTask } from '../types';

type Draft = BreakdownTask & { selected: boolean };

/**
 * §AI PRD → tasks. The server only previews; this dialog owns the apply step so every write goes
 * through the normal task/dependency endpoints (permissions, activity log and realtime included).
 */
export function BreakdownDialog({ projectId }: { projectId: number }) {
  const t = useTranslations('Ai');
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const breakdown = useBreakdown(projectId);
  const [open, setOpen] = useState(false);
  const [prd, setPrd] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [applying, setApplying] = useState(false);

  const reset = () => {
    setPrd('');
    setDrafts([]);
    breakdown.reset();
  };

  const generate = () =>
    breakdown.mutate(prd, {
      onSuccess: (result) => setDrafts(result.tasks.map((task) => ({ ...task, selected: true }))),
      onError: (error) => toast.error(toMessage(error)),
    });

  const selected = drafts.filter((draft) => draft.selected);
  const toggle = (index: number) =>
    setDrafts((current) =>
      current.map((draft, i) => (i === index ? { ...draft, selected: !draft.selected } : draft)),
    );

  const apply = async () => {
    if (selected.length === 0) return;
    setApplying(true);
    try {
      // Preserve list order: dependencies can only point at earlier tasks, so creating in order
      // means every predecessor already has an id when its edge is written.
      const idByIndex = new Map<number, number>();
      let created = 0;
      for (const [index, draft] of drafts.entries()) {
        if (!draft.selected) continue;
        const task = await taskApi.create(projectId, {
          title: draft.title,
          description: draft.description || undefined,
          priority: draft.priority,
          estimateHours: draft.estimateHours ?? undefined,
          tags: draft.tags,
          assigneeId: draft.assigneeId ?? undefined,
        });
        idByIndex.set(index, task.id);
        created += 1;
      }
      for (const [index, draft] of drafts.entries()) {
        if (!draft.selected) continue;
        for (const predecessorIndex of draft.dependsOn) {
          const predecessorId = idByIndex.get(predecessorIndex);
          const successorId = idByIndex.get(index);
          if (!predecessorId || !successorId) continue;
          await schedulingApi.createDependency(projectId, { predecessorId, successorId });
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.tasks.byProject(projectId) }),
        queryClient.invalidateQueries({ queryKey: qk.dependencies.byProject(projectId) }),
        queryClient.invalidateQueries({ queryKey: qk.projects.all }),
      ]);
      toast.success(t('breakdownApplied', { count: created }));
      setOpen(false);
      reset();
    } catch (error) {
      toast.error(toMessage(error));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Wand2 className="size-4" aria-hidden />
          {t('breakdown')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" aria-hidden />
            {t('breakdownTitle')}
          </DialogTitle>
          <DialogDescription>{t('breakdownDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="ai-prd" className="text-sm font-medium">
            {t('prdLabel')}
          </label>
          <Textarea
            id="ai-prd"
            value={prd}
            onChange={(event) => setPrd(event.target.value)}
            placeholder={t('prdPlaceholder')}
            rows={5}
            maxLength={8000}
            disabled={breakdown.isPending || applying}
          />
          <Button
            type="button"
            className="gap-2 self-start"
            onClick={generate}
            disabled={prd.trim().length < 20 || breakdown.isPending || applying}
          >
            {breakdown.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {t('breakdownGenerate')}
          </Button>
        </div>

        {drafts.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {t('breakdownPreview', { count: selected.length, total: drafts.length })}
            </p>
            <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {drafts.map((draft, index) => (
                <li key={`${draft.title}-${index}`} className="flex gap-3 rounded-lg border p-3">
                  <Checkbox
                    checked={draft.selected}
                    onCheckedChange={() => toggle(index)}
                    aria-label={draft.title}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{draft.title}</p>
                    {draft.description && (
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{draft.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="text-[10px]">
                        {t(`priority.${draft.priority}`)}
                      </Badge>
                      {draft.estimateHours !== null && (
                        <Badge variant="outline" className="text-[10px]">
                          {t('hours', { count: draft.estimateHours })}
                        </Badge>
                      )}
                      {draft.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[10px]">
                          {tag}
                        </Badge>
                      ))}
                      {draft.dependsOn.length > 0 && (
                        <span className="text-muted-foreground text-[10px]">
                          {t('dependsOnCount', { count: draft.dependsOn.length })}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {breakdown.isPending && (
          <p className="text-muted-foreground flex items-center gap-2 text-sm" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t('breakdownGenerating')}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={applying}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={apply}
            disabled={selected.length === 0 || applying || breakdown.isPending}
          >
            {applying ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <CheckSquare className="size-4" aria-hidden />
            )}
            {t('breakdownApply', { count: selected.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
