import { useTranslations } from 'next-intl';
import { normalizeError } from '@/lib/api-client';

/** Maps any thrown error to a translated, user-facing message based on its API error code. */
export function useErrorMessage() {
  const t = useTranslations('Errors');
  return (error: unknown): string => {
    const { code } = normalizeError(error);
    return t.has(code) ? t(code) : t('UNKNOWN_ERROR');
  };
}
