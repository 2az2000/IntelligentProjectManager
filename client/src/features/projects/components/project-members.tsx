'use client';

import { useState } from 'react';
import { Check, LogOut, Search, Trash2, UserPlus } from 'lucide-react';
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
  useUpdateMember,
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
  const updateMember = useUpdateMember(project.id);
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
                  {/* Skills feed the AI when it suggests assignees (self or admin can edit). */}
                  {(editable || self) ? (
                    <SkillsEditor projectId={project.id} userId={m.user.id} skills={m.skills} />
                  ) : (
                    m.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {m.skills.map((skill) => (
                          <span key={skill} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )
                  )}
                  <span className="text-xs text-muted-foreground">
                    {t('openWork', { tasks: formatNumber(m.openTasks, locale), points: formatNumber(m.openPoints, locale) })}
                  </span>
                  {/* §3 per-member weekly capacity — drives the workload heatmap & leveling. */}
                  {(editable || self) && (
                    <CapacityEditor
                      projectId={project.id}
                      userId={m.user.id}
                      value={m.capacityHoursPerWeek}
                      openHours={m.openEstimateHours}
                    />
                  )}
                  {editable ? (
                    <Select
                      value={m.role}
                      onValueChange={(role) =>
                        updateMember.mutate({ userId: m.user.id, patch: { role: role as AssignableRole } }, { onError })
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

/**
 * Inline editor for a member's specialties (comma-separated). These strings are what the
 * AI sees when it suggests assignees for a task, so "backend, api" is enough to be useful.
 */
function SkillsEditor({ projectId, userId, skills }: { projectId: number; userId: number; skills: string[] }) {
  const t = useTranslations('Members');
  const toMessage = useErrorMessage();
  const updateMember = useUpdateMember(projectId);
  const [value, setValue] = useState(skills.join(', '));
  const dirty = value !== skills.join(', ');

  const save = () => {
    const next = value
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, 10);
    updateMember.mutate(
      { userId, patch: { skills: next } },
      {
        onSuccess: () => toast.success(t('skillsSaved')),
        onError: (error) => toast.error(toMessage(error)),
      },
    );
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('skillsPlaceholder')}
        aria-label={t('skills')}
        className="h-8 w-48 text-xs"
        disabled={updateMember.isPending}
      />
      {dirty && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          aria-label={t('saveSkills')}
          disabled={updateMember.isPending}
          onClick={save}
        >
          <Check className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

/** §3 per-member weekly capacity (hours/week) — empty = server default. */
function CapacityEditor({
  projectId,
  userId,
  value,
  openHours,
}: {
  projectId: number;
  userId: number;
  value: number | null;
  openHours: number;
}) {
  const t = useTranslations('Members');
  const toMessage = useErrorMessage();
  const updateMember = useUpdateMember(projectId);
  const [input, setInput] = useState(value === null ? '' : String(value));

  const save = () => {
    const next = input.trim() === '' ? null : Math.max(1, Math.min(80, Math.round(Number(input))));
    if (Number.isNaN(next as number)) return;
    updateMember.mutate(
      { userId, patch: { capacityHoursPerWeek: next } },
      { onError: (error) => toast.error(toMessage(error)) },
    );
  };

  const load = value !== null && value > 0 ? Math.round((openHours / value) * 100) : null;
  return (
    <div className="flex items-center gap-1" title={t('capacityTitle')}>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        placeholder='35'
        aria-label={t('capacity')}
        type='number'
        min={1}
        max={80}
        className='h-8 w-20 text-xs'
        disabled={updateMember.isPending}
      />
      {load !== null && (
        <span
          className={`text-[11px] ${load > 110 ? 'text-rose-600' : load > 85 ? 'text-amber-600' : 'text-emerald-600'}`}
          dir='ltr'
        >
          {load}%
        </span>
      )}
    </div>
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
