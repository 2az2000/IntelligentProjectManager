'use client';

import { useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquareText, Pencil, Send, SmilePlus, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/shared/user-avatar';
import { useCurrentUser } from '@/features/auth';
import { useSummarizeThread } from '@/features/ai';
import { useErrorMessage } from '@/hooks/use-error-message';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useEditComment,
  useToggleReaction,
} from '../hooks/use-tasks';
import { applyMention, filterMentionCandidates, mentionQuery } from '../lib/mentions';
import { REACTION_EMOJI } from '../lib/reactions';
import type { Comment, UserSummary } from '../types';

export function TaskComments({
  taskId,
  members,
  canComment,
  isAdmin,
}: {
  taskId: number;
  /** Project members offered by the mention autocomplete. */
  members: UserSummary[];
  canComment: boolean;
  isAdmin: boolean;
}) {
  const t = useTranslations('Comments');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { data: me } = useCurrentUser();
  const { data: comments, isPending } = useComments(taskId);
  const add = useAddComment(taskId);
  const edit = useEditComment(taskId);
  const remove = useDeleteComment(taskId);
  const react = useToggleReaction(taskId);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [mention, setMention] = useState<{ start: number; query: string; active: number } | null>(
    null,
  );
  const composer = useRef<HTMLTextAreaElement>(null);
  const summarize = useSummarizeThread();

  const onError = (error: unknown) => toast.error(toMessage(error));

  const runSummary = () =>
    summarize.mutate(taskId, {
      onSuccess: (result) => setSummary(result.markdown),
      onError,
    });

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    add.mutate(body, {
      onSuccess: () => {
        setDraft('');
        setMention(null);
      },
      onError,
    });
  };

  /** Members matching the current @-query; empty query lists the whole team. */
  const suggestions = useMemo(
    () => (mention === null ? [] : filterMentionCandidates(members, mention.query)),
    [mention, members],
  );

  const syncMention = (value: string, caret: number) => {
    const hit = mentionQuery(value, caret);
    setMention(hit === null ? null : { ...hit, active: 0 });
  };

  const insertMention = (member: UserSummary) => {
    if (mention === null) return;
    const next = applyMention(draft, mention, member);
    setDraft(next.value);
    setMention(null);
    // Put the caret after the inserted name, not at the end of the box.
    requestAnimationFrame(() => {
      composer.current?.focus();
      composer.current?.setSelectionRange(next.caret, next.caret);
    });
  };

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention !== null && suggestions.length > 0) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setMention({
          ...mention,
          active: (mention.active + delta + suggestions.length) % suggestions.length,
        });
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertMention(suggestions[mention.active] ?? suggestions[0]!);
        return;
      }
      if (event.key === 'Escape') {
        setMention(null);
        return;
      }
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) send();
  };

  const reactTo = (comment: Comment, emoji: string) => {
    if (!me) return;
    react.mutate({ commentId: comment.id, emoji, me });
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        {/* §2 long-thread summary — only meaningful for bigger threads. */}
        {(comments?.length ?? 0) >= 5 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            disabled={summarize.isPending}
            onClick={runSummary}
          >
            {summarize.isPending ? (
              <Loader2 aria-hidden className="size-3.5 animate-spin" />
            ) : (
              <MessageSquareText aria-hidden className="size-3.5" />
            )}
            خلاصه
          </Button>
        )}
      </div>
      {summary && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm whitespace-pre-wrap">
          {summary}
        </div>
      )}
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

                  {/* Reactions: one chip per emoji someone used, plus a compact picker. */}
                  {editing?.id !== c.id && (
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {c.reactions.map((reaction) => {
                        const mineReacted = !!me && reaction.users.some((u) => u.id === me.id);
                        return (
                          <button
                            key={reaction.emoji}
                            type="button"
                            aria-pressed={mineReacted}
                            aria-label={
                              mineReacted
                                ? t('removeReaction', { emoji: reaction.emoji })
                                : t('reactionBy', {
                                    names: reaction.users.map((u) => u.name).join('، '),
                                  })
                            }
                            title={reaction.users.map((u) => u.name).join('، ')}
                            onClick={() => reactTo(c, reaction.emoji)}
                            className={cn(
                              'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none transition-colors',
                              mineReacted
                                ? 'border-primary/60 bg-primary/10 text-primary'
                                : 'border-transparent bg-background/60 hover:bg-accent',
                            )}
                          >
                            <span aria-hidden>{reaction.emoji}</span>
                            <span className="tabular-nums">{reaction.users.length}</span>
                          </button>
                        );
                      })}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6 text-muted-foreground"
                            aria-label={t('reactionsToggle')}
                          >
                            <SmilePlus className="size-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-1">
                          <div className="flex gap-1">
                            {REACTION_EMOJI.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                aria-label={emoji}
                                onClick={() => reactTo(c, emoji)}
                                className="rounded-md px-1 text-lg transition-colors hover:bg-accent"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
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
        <div className="relative flex gap-2">
          <Textarea
            ref={composer}
            rows={2}
            value={draft}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            onChange={(e) => {
              setDraft(e.target.value);
              syncMention(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onClick={(e) => syncMention(draft, e.currentTarget.selectionStart ?? draft.length)}
            onKeyDown={onComposerKeyDown}
            onBlur={() => setMention(null)}
          />
          {mention !== null && (
            <ul
              role="listbox"
              aria-label={t('mentionLabel')}
              className="absolute bottom-full start-0 z-20 mb-1 max-h-56 w-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md"
            >
              {suggestions.length === 0 ? (
                <li className="px-2 py-1.5 text-xs text-muted-foreground">{t('mentionEmpty')}</li>
              ) : (
                suggestions.map((member, index) => (
                  <li key={member.id}>
                    {/* onMouseDown keeps the textarea from blurring before the click lands. */}
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === mention.active}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertMention(member);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-start text-sm',
                        index === mention.active ? 'bg-accent' : 'hover:bg-accent/60',
                      )}
                    >
                      <UserAvatar user={member} className="size-5" />
                      <span className="truncate">{member.name}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
          <Button size="icon" onClick={send} disabled={!draft.trim() || add.isPending} aria-label={t('send')}>
            {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 rtl:-scale-x-100" />}
          </Button>
        </div>
      )}
    </section>
  );
}
