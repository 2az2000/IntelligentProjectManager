'use client';

import { useState } from 'react';
import { ListChecks, Plus } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useRouter } from '@/i18n/navigation';
import {
  useCreateProject,
  useCreateProjectFromTemplate,
  useProjectTemplates,
} from '../hooks/use-projects';
import { ProjectForm } from './project-form';

export function CreateProjectDialog() {
  const t = useTranslations('Projects');
  const [open, setOpen] = useState(false);
  const toMessage = useErrorMessage();
  const router = useRouter();
  const createProject = useCreateProject();
  const createFromTemplate = useCreateProjectFromTemplate();
  const { data: templates } = useProjectTemplates();
  const [templateId, setTemplateId] = useState<string>('');

  const pending = createProject.isPending || createFromTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-sm">
          <Plus className="size-4" aria-hidden /> {t('newProject')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('newProject')}</DialogTitle>
        </DialogHeader>
        {templates && templates.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-lg border p-3">
            <Label htmlFor="template" className="flex items-center gap-1.5 text-sm">
              <ListChecks className="size-4 text-muted-foreground" aria-hidden />
              {t('templateLabel')}
            </Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="template" aria-label={t('templateLabel')}>
                <SelectValue placeholder={t('templateNone')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('templateNone')}</SelectItem>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name} · {tpl.tasks.length} {t('templateTasks')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {templateId && templateId !== 'none' && (
              <p className="text-xs text-muted-foreground">
                {templates.find((tpl) => tpl.id === templateId)?.description}
              </p>
            )}
          </div>
        )}
        <ProjectForm
          submitLabel={t('create')}
          pending={pending}
          onSubmit={(input, reset) => {
            const applyTemplate = templateId && templateId !== 'none';
            const mutation = applyTemplate ? createFromTemplate : createProject;
            const payload = applyTemplate ? { templateId, input } : input;
            mutation.mutate(payload as never, {
              onSuccess: (project) => {
                toast.success(applyTemplate ? t('createdFromTemplate') : t('created'));
                reset();
                setTemplateId('');
                setOpen(false);
                router.push(`/projects/${project.id}/board`);
              },
              onError: (error) => toast.error(toMessage(error)),
            });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
