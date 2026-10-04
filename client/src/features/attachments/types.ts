/** Mirrors the attachment DTO in server/src/modules/attachments/attachments.module.ts */
export interface AttachmentUser {
  id: number;
  name: string;
  avatarUrl: string | null;
}

export interface Attachment {
  id: number;
  taskId: number;
  fileName: string;
  mimeType: string;
  size: number;
  uploader: AttachmentUser;
  createdAt: string;
}
