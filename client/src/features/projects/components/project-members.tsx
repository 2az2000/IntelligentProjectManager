'use client';

import { useState } from 'react';
import { LogOut, Search, Trash2, UserPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { TableSkeleton } from '@/components/shared/loading-skeletons';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useCurrentUser } from '@/features/auth';
import { useUserSearch } from '@/features/users';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useRouter } from '@/i18n/navigation';
import { formatNumber } from '@/lib/format';
import {
  useAddMember,
  useProjectMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from '../hooks/use-projects';
import { ASSIGNABLE_ROLES, hasRole, type AssignableRole, type Project } from '../types';

export function ProjectMembers({ project }: { project: Project }) {
  const t = useTranslations('Members');
  const tp = useTranslations('Projects');
  const locale = useLocale();
  const router = useRouter();
  const toMessage = useErrorMessage();
  const onError = (error: unknown) => toast.error(toMessage(error));
  const { data: me } = useCurrentUser();
  const { data: members, isPending } = useProjectMembers(project.id);
  const updateRole = useUpdateMemberRole(project.id);
  const removeMember = useRemoveMember(project.id);

  const canManage = hasRole(project.myRole, 'ADMIN');
  const isOwner = project.myRole === 'OWNER';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('projectMembers')}</CardTitle>
        <CardDescription>{t('projectMembersDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {canManage && <InviteMember project={project} existing={members?.map((m) => m.user.id) ?? []} />}
        {isPending ? (
          <TableSkeleton rows={3} />
        ) : (
          <ul className="divide-y">
            {members?.map((m) => {
              const self = m.user.id === me?.id;
              // Owner-only for admins; nobody edits the owner.
              const editable = canManage && m.role !== 'OWNER' && !self && (isOwner || m.role !== 'ADMIN');
              return (
                <li key={m.user.id} className="flex flex-wrap items-center gap-3 py-3">
                  <UserAvatar user={m.user} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.user.name} {self && <span className="text-muted-foreground">({t('you')})</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">
                      {m.user.email}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('openWork', { tasks: formatNumber(m.openTasks, locale), points: formatNumber(m.openPoints, locale) })}
                  </span>
                  {editable ? (
                    <Select
                      value={m.role}
                      onValueChange={(role) =>
                        updateRole.mutate({ userId: m.user.id, role: role as AssignableRole }, { onError })
                      }
                    >
                      <SelectTrigger className="w-32" aria-label={t('role')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.filter((r) => isOwner || r !== 'ADMIN').map((r) => (
                          <SelectItem key={r} value={r}>
                            {tp(`roles.${r}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="w-32 text-sm">{tp(`roles.${m.role}`)}</span>
                  )}
                  {editable && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={t('remove')}>
                          <Trash2 className="size-4" />
                        </Button>
                      }
                      title={t('removeTitle')}
                      description={t('removeDescription', { name: m.user.name })}
                      confirmLabel={t('remove')}
                      onConfirm={() => removeMember.mutate(m.user.id, { onError })}
                    />
                  )}
                  {self && m.role !== 'OWNER' && (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={t('leave')}>
                          <LogOut className="size-4" />
                        </Button>
                      }
                      title={t('leaveTitle')}
                      description={t('leaveDescription', { project: project.name })}
                      confirmLabel={t('leave')}
                      onConfirm={() =>
                        removeMember.mutate(m.user.id, { onSuccess: () => router.replace('/projects'), onError })
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function InviteMember({ project, existing }: { project: Project; existing: number[] }) {
  const t = useTranslations('Members');
  const tp = useTranslations('Projects');
  const toMessage = useErrorMessage();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<AssignableRole>('MEMBER');
  const { data: results = [], isFetching } = useUserSearch(query);
  const addMember = useAddMember(project.id);
  const candidates = results.filter((u) => !existing.includes(u.id));

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="ps-8"
          />
        </div>
        <Select value={role} onValueChange={(r) => setRole(r as AssignableRole)}>
          <SelectTrigger className="w-32" aria-label={t('role')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASSIGNABLE_ROLES.filter((r) => project.myRole === 'OWNER' || r !== 'ADMIN').map((r) => (
              <SelectItem key={r} value={r}>
                {tp(`roles.${r}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {query.trim().length >= 2 && (
        <ul className="flex flex-col gap-1">
          {candidates.length === 0 && !isFetching && (
            <li className="px-1 text-sm text-muted-foreground">{t('noResults')}</li>
          )}
          {candidates.map((user) => (
            <li key={user.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60">
              <UserAvatar user={user} />
              <span className="flex-1 text-sm">
                {user.name}{' '}
                <span className="text-xs text-muted-foreground" dir="ltr">
                  {user.email}
                </span>
              </span>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                disabled={addMember.isPending}
                onClick={() =>
                  addMember.mutate(
                    { userId: user.id, role },
                    {
                      onSuccess: () => {
                        toast.success(t('added', { name: user.name }));
                        setQuery('');
                      },
                      onError: (error) => toast.error(toMessage(error)),
                    },
                  )
                }
              >
                <UserPlus className="size-4" aria-hidden />
                {t('add')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
