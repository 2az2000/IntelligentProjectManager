'use client';

import { useRef } from 'react';
import { FileDown, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth';
import { useErrorMessage } from '@/hooks/use-error-message';
import { formatBytes, formatRelative } from '@/lib/format';
import { attachmentsApi } from '../api/attachments.api';
import { useDeleteAttachment, useAttachments, useUploadAttachment } from '../hooks/use-attachments';
import type { Attachment } from '../types';

/** Server limit (MAX_UPLOAD_MB, default 10) mirrored for a friendly client-side error. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function AttachmentsSection({ taskId, canEdit }: { taskId: number; canEdit: boolean }) {
  const t = useTranslations('Attachments');
  const locale = useLocale();
  const toMessage = useErrorMessage();
  const { data: me } = useCurrentUser();
  const { data: attachments = [], isPending } = useAttachments(taskId);
  const upload = useUploadAttachment(taskId);
  const remove = useDeleteAttachment(taskId);
  const fileInput = useRef<HTMLInputElement>(null);

  const onPick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t('tooLarge', { max: '10' }));
      return;
    }
    upload.mutate(file, {
      onSuccess: () => toast.success(t('uploaded')),
      onError: (error) => toast.error(toMessage(error)),
    });
    if (fileInput.current) fileInput.current.value = '';
  };

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        {canEdit && (
          <>
            <input
              ref={fileInput}
              type="file"
              className="sr-only"
              aria-label={t('upload')}
              onChange={(e) => onPick(e.target.files)}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 text-xs"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {upload.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" aria-hidden />
              )}
              {t('upload')}
            </Button>
          </>
        )}
      </div>

      {isPending ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              canDelete={canEdit && (attachment.uploader.id === me?.id)}
              onDelete={() => remove.mutate(attachment.id, { onError: (e) => toast.error(toMessage(e)) })}
              deleting={remove.isPending && remove.variables === attachment.id}
              locale={locale}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttachmentRow({
  attachment,
  canDelete,
  onDelete,
  deleting,
  locale,
}: {
  attachment: Attachment;
  canDelete: boolean;
  onDelete: () => void;
  deleting: boolean;
  locale: string;
}) {
  const t = useTranslations('Attachments');
  const downloadUrl = attachmentsApi.downloadUrl(attachment.id);

  return (
    <li className="flex items-center gap-2 rounded-md border px-2 py-1.5">
      <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <a
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          className="block truncate text-sm hover:underline"
          title={attachment.fileName}
        >
          {attachment.fileName}
        </a>
        <p className="text-[10px] text-muted-foreground">
          {formatBytes(attachment.size, locale)} · {attachment.uploader.name} ·{' '}
          {formatRelative(attachment.createdAt, locale)}
        </p>
      </div>
      <Button variant="ghost" size="icon" className="size-7 shrink-0" asChild>
        <a href={downloadUrl} target="_blank" rel="noreferrer" aria-label={t('download')} download>
          <FileDown className="size-3.5" />
        </a>
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-destructive"
          aria-label={t('delete')}
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
        </Button>
      )}
    </li>
  );
}
