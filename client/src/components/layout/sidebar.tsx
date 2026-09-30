'use client';

import {
  Calendar,
  CheckSquare,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  key: 'dashboard' | 'projects' | 'myTasks' | 'calendar' | 'members' | 'settings';
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', href: '/', icon: LayoutDashboard },
  { key: 'projects', href: '/projects', icon: FolderKanban },
  { key: 'myTasks', href: '/my-tasks', icon: CheckSquare },
  { key: 'calendar', href: '/calendar', icon: Calendar },
  { key: 'members', href: '/members', icon: Users },
  { key: 'settings', href: '/settings', icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const t = useTranslations('Nav');
  const tc = useTranslations('Common');
  // Locale-agnostic pathname (no /fa or /en prefix)
  const pathname = usePathname();

  return (
    <nav className={cn('px-3 py-4', className)}>
      <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">{tc('appName')}</h2>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Button
                variant={active ? 'secondary' : 'ghost'}
                className="w-full justify-start"
                asChild
              >
                <Link href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
                  <Icon className="me-2 size-4" aria-hidden />
                  {t(key)}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
