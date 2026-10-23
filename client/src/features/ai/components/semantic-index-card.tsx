'use client';

import { DatabaseZap, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useErrorMessage } from '@/hooks/use-error-message';
import { apiClient } from '@/lib/api-client';
import { qk } from '@/lib/query-keys';
import { useBackfillEmbeddings } from '../hooks/use-ai';

interface SemanticStatus {
  semantic: { available: boolean; model: string };
}

/**
 * §AI semantic search operations. New/edited tasks embed themselves; this card exists for the
 * tasks that predate the feature (and to show whether a provider is configured at all).
 */
export function SemanticIndexCard({ projectId }: { projectId: number }) {
  const t = useTranslations('Ai');
  const toMessage = useErrorMessage();
  const backfill = useBackfillEmbeddings(projectId);
  const { data, isPending } = useQuery({
    queryKey: qk.searchStatus,
    queryFn: async () => (await apiClient.get<SemanticStatus>('/search/status')).data,
    staleTime: 5 * 60 * 1000,
  });

  const available = data?.semantic.available ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseZap className="size-4" aria-hidden />
          {t('semanticTitle')}
        </CardTitle>
        <CardDescription>{t('semanticDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Badge variant={available ? 'secondary' : 'outline'}>
              {available ? t('semanticEnabled') : t('semanticDisabled')}
            </Badge>
          )}
          {data?.semantic.model && (
            <span className="text-muted-foreground font-mono text-xs">{data.semantic.model}</span>
          )}
        </div>
        {!available && !isPending && (
          <p className="text-muted-foreground text-sm">{t('semanticDisabledHint')}</p>
        )}
        {available && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2 self-start"
            disabled={backfill.isPending}
            onClick={() =>
              backfill.mutate(undefined, {
                onSuccess: (result) =>
                  result.failed > 0
                    ? toast.warning(
                        t('semanticIndexedPartial', {
                          embedded: result.embedded,
                          failed: result.failed,
                          total: result.total,
                        }),
                      )
                    : toast.success(t('semanticIndexed', { embedded: result.embedded, total: result.total })),
                onError: (error) => toast.error(toMessage(error)),
              })
            }
          >
            {backfill.isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t('semanticBackfill')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
