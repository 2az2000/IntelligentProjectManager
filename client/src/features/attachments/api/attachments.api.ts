import { apiClient } from '@/lib/api-client';
import type { Attachment } from '../types';

export const attachmentsApi = {
  list: async (taskId: number): Promise<Attachment[]> =>
    (await apiClient.get<Attachment[]>(`/tasks/${taskId}/attachments`)).data,
  /** Multipart upload — the server accepts a single `file` field. Axios sets the multipart boundary itself. */
  upload: async (taskId: number, file: File): Promise<Attachment> => {
    const form = new FormData();
    form.append('file', file);
    return (await apiClient.post<Attachment>(`/tasks/${taskId}/attachments`, form)).data;
  },
  remove: async (attachmentId: number): Promise<void> => {
    await apiClient.delete(`/attachments/${attachmentId}`);
  },
  /** Opens in a new tab with the auth cookie; the server streams the file with a download header. */
  downloadUrl: (attachmentId: number): string =>
    `${apiClient.defaults.baseURL}/attachments/${attachmentId}/download`,
};
