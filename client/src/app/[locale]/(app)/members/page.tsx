import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/shared/page-header';
import { TeamGrid } from '@/features/projects';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Members');

  return (
    <div className="p-8">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <TeamGrid />
    </div>
  );
}
