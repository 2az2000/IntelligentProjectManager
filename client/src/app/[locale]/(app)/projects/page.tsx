import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/shared/page-header';
import { CreateProjectDialog, ProjectGrid } from '@/features/projects';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Projects');

  return (
    <div className="p-8">
      <PageHeader title={t('title')} description={t('subtitle')} actions={<CreateProjectDialog />} />
      <ProjectGrid />
    </div>
  );
}
