'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { statusStyle, type ProjectStatus } from '../types';

/**
 * A column rendered as data: built-ins are translated by key, custom columns show their own
 * label, and the colour always comes from the column itself.
 */
export function StatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const t = useTranslations('Tasks.status');
  return (
    <Badge variant="outline" style={statusStyle(status.color)} className={cn('gap-1', className)}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: status.color }} />
      {t.has(status.key) ? t(status.key) : status.label}
    </Badge>
  );
}

/** The bare colour dot — for column headers, where the label is already spelled out. */
export function StatusDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ backgroundColor: color }}
    />
  );
}
