import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import { attachmentsApi } from '../api/attachments.api';

const validId = (id: number | null | undefined): id is number =>
  typeof id === 'number' && Number.isFinite(id) && id > 0;

export function useAttachments(taskId: number | null) {
  return useQuery({
    queryKey: qk.attachments.byTask(taskId ?? 0),
    queryFn: () => attachmentsApi.list(taskId!),
    enabled: validId(taskId),
  });
}

export function useUploadAttachment(taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => attachmentsApi.upload(taskId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.attachments.byTask(taskId) }),
  });
}

export function useDeleteAttachment(taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: number) => attachmentsApi.remove(attachmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.attachments.byTask(taskId) }),
  });
}
