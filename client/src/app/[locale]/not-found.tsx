import { getTranslations } from 'next-intl/server';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations('NotFound');
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <SearchX className="size-12 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      <Button asChild>
        <Link href="/">{t('home')}</Link>
      </Button>
    </div>
  );
}
