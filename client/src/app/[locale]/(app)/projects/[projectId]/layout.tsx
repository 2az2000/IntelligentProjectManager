import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { ProjectHeader } from '@/features/projects';

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const id = Number((await params).projectId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  return (
    <div className="flex min-h-full flex-col p-8">
      <ProjectHeader projectId={id} />
      {children}
    </div>
  );
}
