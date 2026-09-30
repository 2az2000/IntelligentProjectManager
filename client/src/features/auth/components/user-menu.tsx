'use client';

import { LogOut, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { UserAvatar } from '@/components/shared/user-avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, useRouter } from '@/i18n/navigation';
import { useCurrentUser, useLogout } from '../hooks/use-auth';

export function UserMenu() {
  const t = useTranslations('Nav');
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const router = useRouter();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={t('account')}>
          <UserAvatar user={user} className="size-8" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="truncate">{user.name}</span>
          <span className="truncate text-xs font-normal text-muted-foreground" dir="ltr">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="me-2 size-4" aria-hidden />
            {t('settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}
        >
          <LogOut className="me-2 size-4" aria-hidden />
          {t('logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
