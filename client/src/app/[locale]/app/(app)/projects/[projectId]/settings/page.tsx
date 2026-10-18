import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ProjectSettings } from '@/features/projects';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>;
}) {
  const { locale, projectId } = await params;
  setRequestLocale(locale);
  const id = Number(projectId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <ProjectSettings projectId={id} />;
}
