import { setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from '@/features/auth';

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ResetPasswordForm />;
}
