'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { UserMenu } from '@/features/auth';
import { NotificationBell } from '@/features/notifications';
import { GlobalSearch } from '@/components/shared/global-search';
import { CommandPalette } from './command-palette';
import { Link } from '@/i18n/navigation';
import { ModeToggle } from './mode-toggle';
import { Sidebar } from './sidebar';

export function Navbar() {
  const t = useTranslations('Nav');
  const tc = useTranslations('Common');
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-2 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('toggleMenu')}>
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side={locale === 'fa' ? 'right' : 'left'} className="p-0">
            <Sidebar onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href="/" className="hidden font-bold md:inline-block">
          {tc('appTitle')}
        </Link>

        {/* §4 global search — visible on every app page. */}
        <div className="ms-auto hidden flex-1 justify-end md:flex">
          <GlobalSearch />
        </div>

        <div className="ms-auto flex items-center gap-1 md:ms-2">
          <Button
            variant="ghost"
            size="sm"
            className="hidden gap-1.5 text-muted-foreground md:inline-flex"
            onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
            aria-label={t('commandPalette')}
          >
            <span className="text-xs">{t('commandPalette')}</span>
            <kbd className="rounded border px-1 text-[10px]" aria-hidden>
              ⌘K
            </kbd>
          </Button>
          <NotificationBell />
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <CommandPalette />
    </header>
  );
}
