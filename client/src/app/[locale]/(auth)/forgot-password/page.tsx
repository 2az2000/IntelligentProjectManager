import { setRequestLocale } from 'next-intl/server';
import { ForgotPasswordForm } from '@/features/auth';

export default async function ForgotPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ForgotPasswordForm />;
}
