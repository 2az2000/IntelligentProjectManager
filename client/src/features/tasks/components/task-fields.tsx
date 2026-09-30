'use client';

import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/shared/user-avatar';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
  type UserSummary,
} from '../types';

const UNASSIGNED = 'none';

export function StatusSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: TaskStatus;
  onChange: (value: TaskStatus) => void;
  disabled?: boolean;
  id?: string;
}) {
  const t = useTranslations('Tasks');
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskStatus)} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.map((s) => (
          <SelectItem key={s} value={s}>
            {t(`status.${s}`)}
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

export function AssigneeSelect({
  value,
  onChange,
  members,
  disabled,
  id,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  members: UserSummary[];
  disabled?: boolean;
  id?: string;
}) {
  const t = useTranslations('Tasks');
  return (
    <Select
      value={value === null ? UNASSIGNED : String(value)}
      onValueChange={(v) => onChange(v === UNASSIGNED ? null : Number(v))}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>{t('unassigned')}</SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={String(m.id)}>
            <span className="flex items-center gap-2">
              <UserAvatar user={m} className="size-5" />
              {m.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
