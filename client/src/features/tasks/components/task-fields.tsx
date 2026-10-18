'use client';

import { useState } from 'react';
import { Crown, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/shared/user-avatar';
import { StatusDot, sortStatuses, type ProjectStatus } from '@/features/statuses';
import { cn } from '@/lib/utils';
import {
  coAssigneeCount,
  isLeadAssignee,
  knownAssignees,
  promoteAssignee,
  toggleAssignee,
} from '../lib/assignees';
import { TASK_PRIORITIES, type TaskPriority, type UserSummary } from '../types';

/** The project's own workflow columns — built-ins translated by key, custom ones by label. */
export function StatusSelect({
  value,
  statuses,
  onChange,
  disabled,
  id,
}: {
  /** A `ProjectStatus.key`. */
  value: string;
  statuses: ProjectStatus[];
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
}) {
  const t = useTranslations('Tasks.status');
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sortStatuses(statuses).map((status) => (
          <SelectItem key={status.key} value={status.key}>
            <span className="flex items-center gap-2">
              <StatusDot color={status.color} />
              {t.has(status.key) ? t(status.key) : status.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PrioritySelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: TaskPriority;
  onChange: (value: TaskPriority) => void;
  disabled?: boolean;
  id?: string;
}) {
  const t = useTranslations('Tasks');
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskPriority)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            {t(`priority.${p}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Overlapping avatars for a task with several owners (RTL-aware). */
export function AssigneeStack({
  assignees,
  className,
  max = 3,
}: {
  assignees: UserSummary[];
  className?: string;
  max?: number;
}) {
  const shown = assignees.slice(0, max);
  const rest = assignees.length - shown.length;
  return (
    <span
      className={cn('flex items-center -space-x-1.5 rtl:space-x-reverse', className)}
      title={assignees.map((u) => u.name).join('، ')}
    >
      {shown.map((user) => (
        <UserAvatar key={user.id} user={user} className="size-6 ring-2 ring-card" />
      ))}
      {rest > 0 && (
        <span className="bg-muted text-muted-foreground ring-card inline-flex size-6 items-center justify-center rounded-full text-[10px] font-medium ring-2">
          +{rest}
        </span>
      )}
    </span>
  );
}

/**
 * The task's owners: a checkbox list where exactly one assignee can be the **lead**.
 *
 * The set is ordered, so the value is `number[]` with the lead first — the same shape the API
 * stores (`assigneeIds`). Everyone on the task is notified and sees it in "my tasks"; the lead is
 * only the person the reports count the task against.
 */
export function AssigneePicker({
  value,
  onChange,
  members,
  disabled,
  id,
}: {
  /** Ordered ids: `value[0]` is the lead. */
  value: number[];
  onChange: (value: number[]) => void;
  members: UserSummary[];
  disabled?: boolean;
  id?: string;
}) {
  const t = useTranslations('Tasks');
  //
  // The field saves on every change, so the server answer arrives a moment later. A local copy
  // keeps the click instant instead of snapping back until that round-trip lands; it is dropped
  // as soon as the task's real assignee set catches up (compared by content, so a plain re-render
  // — a fresh array each time — never resets it).
  const signature = value.join(',');
  const [pending, setPending] = useState<{ signature: string; ids: number[] } | null>(null);
  const draft = pending && pending.signature !== signature ? pending.ids : value;

  // Someone removed from the project would be rejected by the API, so a change drops them.
  const update = (next: number[]) => {
    const cleaned = knownAssignees(next, members);
    setPending({ signature: cleaned.join(','), ids: cleaned });
    onChange(cleaned);
  };
  const byId = new Map(members.map((m) => [m.id, m]));
  // A member removed from the project still shows on the task until it is edited away.
  const selected = draft.map(
    (userId) => byId.get(userId) ?? { id: userId, name: `#${userId}`, avatarUrl: null },
  );
  const lead = selected[0];
  const extras = coAssigneeCount(draft);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          aria-label={t('assigneeLabel')}
          className="h-9 w-full justify-start gap-2 px-2.5 font-normal"
        >
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{t('unassigned')}</span>
          ) : (
            <>
              <AssigneeStack assignees={selected} />
              <span className="truncate">{lead?.name}</span>
              {extras > 0 && (
                <span className="text-muted-foreground">
                  {t('coAssigneeCount', { count: extras })}
                </span>
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <ul className="max-h-64 overflow-y-auto">
          {members.length === 0 && (
            <li className="text-muted-foreground px-2 py-1.5 text-sm">{t('noMembers')}</li>
          )}
          {members.map((member) => {
            const checked = draft.includes(member.id);
            const isLead = isLeadAssignee(draft, member.id);
            return (
              <li
                key={member.id}
                className="hover:bg-muted/60 flex items-center gap-2 rounded-md px-1.5 py-1.5"
              >
                <Checkbox
                  id={`${id}-${member.id}`}
                  checked={checked}
                  onCheckedChange={(next) => update(toggleAssignee(draft, member.id, next === true))}
                />
                <label
                  htmlFor={`${id}-${member.id}`}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm"
                >
                  <UserAvatar user={member} className="size-5" />
                  <span className="truncate">{member.name}</span>
                </label>
                {isLead ? (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px] whitespace-nowrap">
                    <Crown className="size-3" aria-hidden />
                    {t('leadAssignee')}
                  </span>
                ) : (
                  checked && (
                    <button
                      type="button"
                      onClick={() => update(promoteAssignee(draft, member.id))}
                      className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[10px] whitespace-nowrap"
                    >
                      <Crown className="size-3" aria-hidden />
                      {t('makeLead')}
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-muted-foreground flex items-center gap-1.5 px-2 py-1.5 text-[11px]">
          <Users className="size-3" aria-hidden />
          {t('assigneeHint')}
        </p>
      </PopoverContent>
    </Popover>
  );
}
