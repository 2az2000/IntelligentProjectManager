'use client';

import { Copy, Loader2, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useErrorMessage } from '@/hooks/use-error-message';
import { formatNumber } from '@/lib/format';
import { useWeeklySummary } from '../hooks/use-ai';

/**
 * §AI weekly project report. The Monday 08:00 job generates the same document and mails it;
 * this card is the on-demand path (and a preview of what the team will receive).
 */
export function WeeklySummaryCard({ projectId }: { projectId: number }) {
  const t = useTranslations('Ai');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const summary = useWeeklySummary(projectId);

  const stats = summary.data?.stats;
  const items = stats
    ? [
        { key: 'completed', value: stats.completed },
        { key: 'created', value: stats.created },
        { key: 'open', value: stats.open },
        { key: 'overdue', value: stats.overdue },
        { key: 'blocked', value: stats.blocked },
        { key: 'activity', value: stats.activity },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" aria-hidden />
          {t('weeklyTitle')}
        </CardTitle>
        <CardDescription>{t('weeklyDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          type="button"
          className="gap-2 self-start"
          disabled={summary.isPending}
          onClick={() =>
            summary.mutate(undefined, {
              onError: (error) => toast.error(toMessage(error)),
            })
          }
        >
          {summary.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {t('weeklyGenerate')}
        </Button>

        {summary.isPending && (
          <p className="text-muted-foreground text-sm" role="status">
            {t('weeklyGenerating')}
          </p>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {items.map((item) => (
              <div key={item.key} className="rounded-lg border p-2.5">
                <p className="text-muted-foreground text-xs">{t(`weeklyStats.${item.key}`)}</p>
                <p className="text-lg font-semibold">{formatNumber(item.value, locale)}</p>
              </div>
            ))}
          </div>
        )}

        {summary.data && (
          <div className="flex flex-col gap-2">
            <div className="bg-muted/40 max-h-96 overflow-auto rounded-md border p-3">
              <pre className="font-sans text-sm leading-6 whitespace-pre-wrap" dir="auto">
                {summary.data.markdown}
              </pre>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 self-end"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(summary.data.markdown);
                  toast.success(t('copied'));
                } catch {
                  toast.error(t('copyFailed'));
                }
              }}
            >
              <Copy className="size-4" aria-hidden />
              {t('copy')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
