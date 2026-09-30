'use client';

import { useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ErrorState } from '@/components/shared/error-state';
import { usePathname, useRouter } from '@/i18n/navigation';
import { onUnauthorized } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { useCurrentUser } from '../hooks/use-auth';

/** Renders children only for signed-in users; otherwise redirects to /login?next=… */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { data: user, isPending, isError, error, refetch } = useCurrentUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();

  // Apply the theme saved in the user's profile.
  useEffect(() => {
    if (user?.theme) setTheme(user.theme);
  }, [user?.theme, setTheme]);

  // Session could not be refreshed by the API client ⇒ treat as signed out.
  useEffect(
    () => onUnauthorized(() => queryClient.setQueryData(qk.auth.me, null)),
    [queryClient],
  );

  useEffect(() => {
    if (user === null) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [user, router, pathname]);

  if (isError) {
    return (
      <div className="p-8">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }
  if (isPending || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-busy>
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return children;
}
