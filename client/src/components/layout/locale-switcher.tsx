'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Toggles between Persian and English, keeping the current path and query. */
export function LocaleSwitcher() {
  const t = useTranslations('Nav');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const nextLocale = locale === 'fa' ? 'en' : 'fa';

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1"
      aria-label={t('switchLanguage')}
      onClick={() => router.replace(`${pathname}${search ? `?${search}` : ''}`, { locale: nextLocale })}
    >
      <Languages className="size-4" aria-hidden />
      {nextLocale === 'fa' ? 'فارسی' : 'English'}
    </Button>
  );
}
