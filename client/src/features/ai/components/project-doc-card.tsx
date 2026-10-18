'use client';

import { useEffect, useState } from 'react';
import { Copy, Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useErrorMessage } from '@/hooks/use-error-message';
import { normalizeError } from '@/lib/api-client';
import { useProjectDoc } from '../hooks/use-ai';

/** Fallback cooldown when the provider did not tell us how long to wait. */
const RATE_LIMIT_COOLDOWN_SECONDS = 60;
/** Never lock the button for longer than this, whatever the provider claims. */
const MAX_COOLDOWN_SECONDS = 600;

/** The provider's own "come back in N seconds" hint, relayed by the server as `details`. */
function retryAfterSeconds(details: unknown): number | null {
  if (typeof details !== 'object' || details === null) return null;
  const value = (details as { retryAfterSeconds?: unknown }).retryAfterSeconds;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(Math.ceil(value), MAX_COOLDOWN_SECONDS);
}

/**
 * Phase 7: AI-generated full project documentation — lives in each project's own settings.
 * Like enrich-task this is a preview: the Markdown is returned and shown here,
 * nothing is stored on the server.
 */
export function ProjectDocCard({ projectId }: { projectId: number }) {
  const t = useTranslations('Projects');
  const toMessage = useErrorMessage();
  const generate = useProjectDoc();
  const [cooldown, setCooldown] = useState(0);

  // Count the rate-limit cooldown down once per second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const handleGenerate = () =>
    generate.mutate(projectId, {
      onError: (error) => {
        const normalized = normalizeError(error);
        if (normalized.code === 'AI_RATE_LIMITED') {
          setCooldown(retryAfterSeconds(normalized.details) ?? RATE_LIMIT_COOLDOWN_SECONDS);
        } else {
          toast.error(toMessage(error));
        }
      },
    });

  const handleCopy = async () => {
    if (!generate.data) return;
    try {
      await navigator.clipboard.writeText(generate.data.markdown);
      toast.success(t('docCopied'));
    } catch {
      toast.error(t('docCopyFailed'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('docTitle')}</CardTitle>
        <CardDescription>{t('docDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          type="button"
          className="gap-2 self-start"
          disabled={generate.isPending || cooldown > 0}
          onClick={handleGenerate}
        >
          {generate.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {t('docGenerate')}
        </Button>

        {generate.isPending && (
          <p className="text-sm text-muted-foreground" role="status">
            {t('docGenerating')}
          </p>
        )}

        {cooldown > 0 && (
          <p className="text-sm text-muted-foreground" role="status">
            {t('docRateLimited', { seconds: cooldown })}
          </p>
        )}

        {generate.data && (
          <div className="flex flex-col gap-2">
            <div className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-3">
              <pre className="font-sans text-sm leading-6 whitespace-pre-wrap" dir="auto">
                {generate.data.markdown}
              </pre>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 self-end"
              onClick={handleCopy}
            >
              <Copy className="size-4" aria-hidden />
              {t('docCopy')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
