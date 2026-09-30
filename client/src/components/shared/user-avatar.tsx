import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

export function UserAvatar({
  user,
  className,
}: {
  user: { name: string; avatarUrl: string | null };
  className?: string;
}) {
  return (
    <Avatar className={cn('size-7', className)} title={user.name}>
      <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
      <AvatarFallback className="text-[10px]">{initials(user.name)}</AvatarFallback>
    </Avatar>
  );
}
