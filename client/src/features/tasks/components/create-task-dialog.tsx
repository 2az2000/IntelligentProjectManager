'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
import { useErrorMessage } from '@/hooks/use-error-message';
import { toDayIso } from '@/lib/calendar';
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

  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: EMPTY });

  const onSubmit = form.handleSubmit((values) =>
    createTask.mutate(
      {
        title: values.title,
        description: values.description || undefined,
        status: values.status,
        priority: values.priority,
        assigneeId: values.assigneeId ?? undefined,
        dueDate: values.dueDate ? toDayIso(values.dueDate) : undefined,
        points: values.points ?? undefined,
        estimateHours: values.estimateHours ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('created'));
          form.reset(EMPTY);
          setOpen(false);
        },
        onError: (error) => toast.error(toMessage(error)),
      },
    ),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
