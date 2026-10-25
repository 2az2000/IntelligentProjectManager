'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useErrorMessage } from '@/hooks/use-error-message';
import { cn } from '@/lib/utils';
import { useProjectChat } from '../hooks/use-ai';
import type { ChatTurn } from '../types';

/**
 * §AI chat with the project. The server sends a read-only snapshot scoped by the caller's role;
 * the prompt cannot write, so a VIEWER gets the same answers as an OWNER about data, and nothing
 * more.
 */
export function ProjectChat({ projectId, compact = false }: { projectId: number; compact?: boolean }) {
  const t = useTranslations('Ai');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const chat = useProjectChat(projectId);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, chat.isPending, open]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || chat.isPending) return;
    const next: ChatTurn[] = [...turns, { role: 'user', content }];
    setTurns(next);
    setInput('');
    chat.mutate(next, {
      onSuccess: (result) => setTurns((current) => [...current, { role: 'assistant', content: result.answer }]),
      onError: (error) => {
        // Keep the question so the user can retry it with one click.
        toast.error(toMessage(error));
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground"
            aria-label={t('chat')}
            title={t('chat')}
          >
            <Sparkles className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Sparkles className="size-4" aria-hidden />
            {t('chat')}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side={locale === 'fa' ? 'left' : 'right'} className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4" aria-hidden />
            {t('chatTitle')}
          </SheetTitle>
          <SheetDescription>{t('chatDescription')}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
          {turns.length === 0 && (
            <div className="text-muted-foreground space-y-3 text-sm">
              <p>{t('chatIntro')}</p>
              <div className="flex flex-wrap gap-1.5">
                {[t('chatExample1'), t('chatExample2'), t('chatExample3')].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => send(example)}
                    className="bg-muted hover:bg-accent rounded-full px-3 py-1 text-xs"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn, index) => (
            <div
              key={index}
              className={cn('flex', turn.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                dir="auto"
                className={cn(
                  'max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                  turn.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground',
                )}
              >
                {turn.content}
              </div>
            </div>
          ))}

          {chat.isPending && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs" role="status">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {t('loading')}
            </p>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send(input);
              }
            }}
            placeholder={t('chatPlaceholder')}
            aria-label={t('chatPlaceholder')}
            rows={2}
            maxLength={4000}
            disabled={chat.isPending}
            className="min-h-0 resize-none"
          />
          <Button type="submit" size="icon" disabled={!input.trim() || chat.isPending} aria-label={t('send')}>
            <Send className="size-4 rtl:-scale-x-100" aria-hidden />
          </Button>
          {turns.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setTurns([])}
              aria-label={t('clearChat')}
              title={t('clearChat')}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
