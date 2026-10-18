import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/shared/page-header';
import { MyTasks } from '@/features/tasks';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('MyTasks');

  return (
    <div className="mx-auto max-w-4xl p-8">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <MyTasks />
    </div>
  );
}
