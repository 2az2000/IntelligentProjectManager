import { redirect } from 'next/navigation';

/** Locale-aware app root: /fa/app and /en/app forward to the dashboard. */
export default async function AppRoot({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/app/dashboard`);
}
