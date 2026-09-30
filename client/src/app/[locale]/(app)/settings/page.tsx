import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@/components/shared/page-header';
import { SettingsPanel } from '@/features/settings';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Settings');

  return (
    <div className="mx-auto max-w-3xl p-8">
      <PageHeader title={t('title')} description={t('subtitle')} />
      <SettingsPanel />
    </div>
  );
}
