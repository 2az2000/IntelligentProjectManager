'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/shared/date-picker';
import { toDayIso } from '@/lib/calendar';
import type { ProjectInput } from '../api/project.api';
import { projectFormSchema, type ProjectFormValues } from '../schemas/project.schema';
import type { Project } from '../types';

export const toProjectInput = (values: ProjectFormValues): ProjectInput => ({
  name: values.name,
  description: values.description || null,
  startDate: values.startDate ? toDayIso(values.startDate) : null,
  endDate: values.endDate ? toDayIso(values.endDate) : null,
});

export const projectDefaults = (project?: Project): ProjectFormValues => ({
  name: project?.name ?? '',
  description: project?.description ?? '',
  startDate: project?.startDate ? new Date(project.startDate) : null,
  endDate: project?.endDate ? new Date(project.endDate) : null,
});

/** Name, description and timeline — shared by "new project" and project settings. */
export function ProjectForm({
  initial,
  submitLabel,
  pending,
  disabled,
  onSubmit,
}: {
  initial?: Project;
  submitLabel: string;
  pending: boolean;
  disabled?: boolean;
  onSubmit: (input: ProjectInput, reset: () => void) => void;
}) {
  const t = useTranslations('Projects');
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: projectDefaults(initial),
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) =>
          onSubmit(toProjectInput(values), () => form.reset(projectDefaults(initial))),
        )}
        className="flex flex-col gap-4"
        noValidate
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('nameLabel')}</FormLabel>
              <FormControl>
                <Input placeholder={t('namePlaceholder')} disabled={disabled} {...field} />
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
                <Textarea rows={3} placeholder={t('descriptionPlaceholder')} disabled={disabled} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('startDate')}</FormLabel>
                <DatePicker value={field.value} onChange={field.onChange} disabled={disabled} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('endDate')}</FormLabel>
                <DatePicker value={field.value} onChange={field.onChange} disabled={disabled} />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {!disabled && (
          <Button type="submit" disabled={pending} className="self-end">
            {pending && <Loader2 className="me-2 size-4 animate-spin" />}
            {submitLabel}
          </Button>
        )}
      </form>
    </Form>
  );
}
