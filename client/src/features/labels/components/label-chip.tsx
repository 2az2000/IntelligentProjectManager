'use client';

import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FALLBACK_LABEL_ICON, LABEL_ICON_BY_KEY } from '../lib/label-icons';
import { labelStyle, type Label } from '../types';

/**
 * One label pill. A tag with no matching label still renders (grey, tag icon) so free-typed
 * tags are never hidden — the vocabulary adds colour, it does not gate what can be attached.
 */
export function LabelChip({
  name,
  label,
  onRemove,
  className,
}: {
  name: string;
  label?: Label;
  onRemove?: () => void;
  className?: string;
}) {
  const Icon = LABEL_ICON_BY_KEY[label?.icon ?? ''] ?? FALLBACK_LABEL_ICON;
  const content = (
    <>
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">{name}</span>
      {onRemove && <X className="size-3 shrink-0 opacity-60 group-hover/chip:opacity-100" aria-hidden />}
    </>
  );

  const shared = cn(
    'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4',
    className,
  );

  if (onRemove) {
    return (
      <button
        type="button"
        onClick={onRemove}
        style={label ? labelStyle(label.color) : undefined}
        className={cn(shared, 'group/chip cursor-pointer', !label && 'bg-muted text-muted-foreground')}
      >
        {content}
      </button>
    );
  }

  return (
    <Badge
      variant="outline"
      style={label ? labelStyle(label.color) : undefined}
      className={cn(shared, 'font-normal', !label && 'text-muted-foreground')}
    >
      {content}
    </Badge>
  );
}
