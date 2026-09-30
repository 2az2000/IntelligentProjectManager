import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/shared/page-header';
import { TaskCalendar } from '@/features/tasks';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Calendar');

  return (
    <div className="p-8">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <TaskCalendar />
    </div>
  );
}
