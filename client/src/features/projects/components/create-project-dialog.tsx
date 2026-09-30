'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { useErrorMessage } from '@/hooks/use-error-message';
import { useRouter } from '@/i18n/navigation';
import { useCreateProject } from '../hooks/use-projects';
import { ProjectForm } from './project-form';

export function CreateProjectDialog() {
  const t = useTranslations('Projects');
  const [open, setOpen] = useState(false);
  const toMessage = useErrorMessage();
  const router = useRouter();
  const createProject = useCreateProject();

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
        <ProjectForm
          submitLabel={t('create')}
          pending={createProject.isPending}
          onSubmit={(input, reset) =>
            createProject.mutate(input, {
              onSuccess: (project) => {
                toast.success(t('created'));
                reset();
                setOpen(false);
                router.push(`/projects/${project.id}/board`);
              },
              onError: (error) => toast.error(toMessage(error)),
            })
          }
        />
      </DialogContent>
    </Dialog>
  );
}
