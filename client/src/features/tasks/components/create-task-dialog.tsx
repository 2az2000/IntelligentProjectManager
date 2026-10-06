'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/shared/date-picker';
import { useEnrichTask } from '@/features/ai';
import { useErrorMessage } from '@/hooks/use-error-message';
import { toDayIso } from '@/lib/calendar';
import { taskApi } from '../api/task.api';
import { useCreateTask } from '../hooks/use-tasks';
import { taskFormSchema, type TaskFormValues } from '../schemas/task.schema';
import type { UserSummary } from '../types';
import { AssigneeSelect, PrioritySelect, StatusSelect } from './task-fields';

const EMPTY: TaskFormValues = {
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  assigneeId: null,
  dueDate: null,
  points: null,
  estimateHours: null,
};

export function CreateTaskDialog({ projectId, members }: { projectId: number; members: UserSummary[] }) {
  const t = useTranslations('Tasks');
  const [open, setOpen] = useState(false);
  const toMessage = useErrorMessage();
  const createTask = useCreateTask(projectId);
  const enrich = useEnrichTask(projectId);
  /** AI-suggested subtasks (checkbox list) — applied after the parent task is created. */
  const [aiSubtasks, setAiSubtasks] = useState<{ title: string; selected: boolean }[]>([]);

  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: EMPTY });
  const title = form.watch('title');
  const assigneeId = form.watch('assigneeId');
  const assigneeHint = enrich.data?.suggestedAssignees.find((a) => a.userId === assigneeId)?.reason;

  /** AI completes the rough task: fills untouched fields and lists suggested subtasks. */
  const handleEnrich = () => {
    enrich.mutate(
      { title: title.trim(), description: form.getValues('description') || undefined },
      {
        onSuccess: (preview) => {
          // The AI assists, it never overrides: only empty fields are prefilled.
          if (!form.getValues('description') && preview.description) {
            form.setValue('description', preview.description);
          }
          if (form.getValues('estimateHours') == null && preview.estimateHours != null) {
            form.setValue('estimateHours', preview.estimateHours);
          }
          if (assigneeId == null && preview.suggestedAssignees[0]) {
            form.setValue('assigneeId', preview.suggestedAssignees[0].userId);
          }
          setAiSubtasks(preview.subtasks.map((subtask) => ({ title: subtask, selected: true })));
        },
        onError: (error) => toast.error(toMessage(error)),
      },
    );
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const task = await createTask.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeId ?? undefined,
        dueDate: values.dueDate ? toDayIso(values.dueDate) : undefined,
        points: values.points ?? undefined,
        estimateHours: values.estimateHours ?? undefined,
      });
      // Selected AI subtasks become real subtasks of the freshly created task.
      for (const subtask of aiSubtasks.filter((s) => s.selected && s.title.trim())) {
        await taskApi.create(projectId, { parentId: task.id, title: subtask.title.trim() });
      }
      toast.success(t('created'));
      form.reset(EMPTY);
      setAiSubtasks([]);
      setOpen(false);
    } catch (error) {
      toast.error(toMessage(error));
    }
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAiSubtasks([]);
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" aria-hidden /> {t('newTask')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('newTask')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('titleLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('titlePlaceholder')} autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={title.trim().length < 3 || enrich.isPending}
                onClick={handleEnrich}
              >
                {enrich.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" aria-hidden />
                )}
                {t('aiComplete')}
              </Button>
            </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('descriptionLabel')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {aiSubtasks.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border p-3">
                <p className="text-sm font-medium">{t('aiSubtasks')}</p>
                {aiSubtasks.map((subtask, index) => (
                  <label key={`${subtask.title}-${index}`} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={subtask.selected}
                      onCheckedChange={(checked) =>
                        setAiSubtasks((prev) =>
                          prev.map((s, i) => (i === index ? { ...s, selected: checked === true } : s)),
                        )
                      }
                    />
                    <span className="flex-1">{subtask.title}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      aria-label={t('removeSuggestion')}
                      onClick={() => setAiSubtasks((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </label>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('statusLabel')}</FormLabel>
                    <StatusSelect value={field.value} onChange={field.onChange} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('priorityLabel')}</FormLabel>
                    <PrioritySelect value={field.value} onChange={field.onChange} />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('assigneeLabel')}</FormLabel>
                    <AssigneeSelect value={field.value} onChange={field.onChange} members={members} />
                    {assigneeHint && (
                      <p className="text-xs text-muted-foreground">✨ {assigneeHint}</p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="points"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('pointsLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={1000}
                        inputMode="numeric"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimateHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('estimateHoursLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={10000}
                        step="0.5"
                        value={field.value ?? ''}
                        onChange={(e) =>
                          field.onChange(e.target.value === '' ? null : Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('dueDateLabel')}</FormLabel>
                  <DatePicker value={field.value} onChange={field.onChange} />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={createTask.isPending}>
              {createTask.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
              {t('newTask')}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
