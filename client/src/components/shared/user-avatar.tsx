import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

/**
 * Avatars uploaded through /users/me/avatar are stored as server-relative paths
 * (`/avatars/<uuid>.png`); external URLs (or data/blob URLs) pass through unchanged.
 */
export function avatarSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${apiClient.defaults.baseURL ?? ''}${url.startsWith('/') ? url : `/${url}`}`;
}

export function UserAvatar({
  user,
  className,
}: {
  user: { name: string; avatarUrl: string | null };
  className?: string;
}) {
  return (
    <Avatar className={cn('size-7', className)} title={user.name}>
      <AvatarImage src={avatarSrc(user.avatarUrl)} alt="" />
      <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
    </Avatar>
  );
}
