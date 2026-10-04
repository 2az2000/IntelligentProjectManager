'use client';

import { useTranslations } from 'next-intl';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useProjectMembers } from '@/features/projects/hooks/use-projects';
import { useProjectPresence } from '../hooks/use-realtime';

const MAX_AVATARS = 5;

/** Overlapping avatars of the members currently online in this project room. */
export function PresenceAvatars({ projectId }: { projectId: number }) {
  const t = useTranslations('Realtime');
  const { data: members = [] } = useProjectMembers(projectId);
  const onlineIds = useProjectPresence(projectId);

  const online = members
    .filter((member) => onlineIds.includes(member.user.id))
    .map((member) => member.user);
  if (online.length === 0) return null;

  const shown = online.slice(0, MAX_AVATARS);
  const names = online.map((user) => user.name).join('، ');

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex -space-x-2 space-x-reverse"
          role="status"
          aria-label={t('onlineCount', { count: online.length })}
        >
          {shown.map((user) => (
            <UserAvatar key={user.id} user={user} className="size-7 ring-2 ring-background" />
          ))}
          {online.length > shown.length && (
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
              +{online.length - shown.length}
            </span>
          )}
          <span className="ms-1 size-2 self-center rounded-full bg-emerald-500" aria-hidden />
        </div>
      </TooltipTrigger>
      <TooltipContent>{t('onlineCount', { count: online.length })}</TooltipContent>
      <span className="sr-only">{names}</span>
    </Tooltip>
  );
}
