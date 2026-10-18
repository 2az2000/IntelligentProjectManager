import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/shared/page-header';
import { DashboardView } from '@/features/dashboard';
import { CreateProjectDialog } from '@/features/projects';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Dashboard');

  return (
    <div className="p-8">
      <PageHeader title={t('title')} description={t('subtitle')} actions={<CreateProjectDialog />} />
      <DashboardView />
    </div>
  );
}
