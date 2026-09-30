'use client';

import { useState } from 'react';
import { Loader2, Pencil, Send, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useCurrentUser } from '@/features/auth';
import { useErrorMessage } from '@/hooks/use-error-message';
import { formatRelative } from '@/lib/format';
import { useAddComment, useComments, useDeleteComment, useEditComment } from '../hooks/use-tasks';

export function TaskComments({ taskId, canComment, isAdmin }: { taskId: number; canComment: boolean; isAdmin: boolean }) {
  const t = useTranslations('Comments');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { data: me } = useCurrentUser();
  const { data: comments, isPending } = useComments(taskId);
  const add = useAddComment(taskId);
  const edit = useEditComment(taskId);
  const remove = useDeleteComment(taskId);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);

  const onError = (error: unknown) => toast.error(toMessage(error));

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    add.mutate(body, { onSuccess: () => setDraft(''), onError });
  };

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{t('title')}</h3>
      {isPending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : comments?.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments?.map((c) => {
            const mine = c.author.id === me?.id;
            return (
              <li key={c.id} className="flex gap-2">
                <UserAvatar user={c.author} />
                <div className="min-w-0 flex-1 rounded-lg bg-muted/60 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{c.author.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatRelative(c.createdAt, locale)}
                      {c.edited && ` · ${t('edited')}`}
                    </span>
                  </div>
                  {editing?.id === c.id ? (
                    <div className="mt-1 flex flex-col gap-1">
                      <Textarea
                        rows={2}
                        value={editing.body}
                        onChange={(e) => setEditing({ id: c.id, body: e.target.value })}
                        autoFocus
                      />
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          {t('cancel')}
                        </Button>
                        <Button
                          size="sm"
                          disabled={!editing.body.trim() || edit.isPending}
                          onClick={() =>
                            edit.mutate(
                              { id: c.id, body: editing.body },
                              { onSuccess: () => setEditing(null), onError },
                            )
                          }
                        >
                          {t('save')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm break-words whitespace-pre-wrap">{c.body}</p>
                  )}
                  {(mine || isAdmin) && editing?.id !== c.id && (
                    <div className="mt-1 flex justify-end gap-1">
                      {mine && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6"
                          aria-label={t('edit')}
                          onClick={() => setEditing({ id: c.id, body: c.body })}
                        >
                          <Pencil className="size-3" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6"
                        aria-label={t('delete')}
                        onClick={() => remove.mutate(c.id, { onError })}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canComment && (
        <div className="flex gap-2">
          <Textarea
            rows={2}
            value={draft}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send();
            }}
          />
          <Button size="icon" onClick={send} disabled={!draft.trim() || add.isPending} aria-label={t('send')}>
            {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rtl:-scale-x-100" />}
          </Button>
        </div>
      )}
    </section>
  );
}
