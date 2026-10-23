'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const KEYS: { key: string; label: 'newTask' | 'search' | 'move' | 'status' | 'help' }[] = [
  { key: 'C', label: 'newTask' },
  { key: '/', label: 'search' },
  { key: 'J / K', label: 'move' },
  { key: '1–4', label: 'status' },
  { key: '?', label: 'help' },
];

/** §4 the `?` cheat sheet — one row per shortcut, no hidden magic. */
export function TaskShortcutsHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations('Tasks.shortcuts');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('hint')}</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-2 text-sm">
          {KEYS.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3">
              <dt>{t(row.label)}</dt>
              <dd>
                <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-xs" dir="ltr">
                  {row.key}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
