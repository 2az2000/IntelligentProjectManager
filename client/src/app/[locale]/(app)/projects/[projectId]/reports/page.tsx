import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ProjectReports } from '@/features/scheduling';

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const id = Number(projectId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ProjectReports projectId={id} />;
}
