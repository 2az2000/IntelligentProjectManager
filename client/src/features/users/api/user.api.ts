import type { EmailPreferences } from '@managesys/contracts';
import { apiClient } from '@/lib/api-client';
import type { User } from '@/features/auth';

export interface UserSearchResult {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface ProfileInput {
  name?: string;
  avatarUrl?: string | null;
  locale?: 'fa' | 'en';
  theme?: 'light' | 'dark' | 'system' | null;
  notifyEmail?: boolean;
  /** §2.1 partial update: omitted kinds keep their stored value. */
  emailPreferences?: Partial<EmailPreferences>;
  /** §4 onboarding stamp — set once the first-run tour is finished or skipped. */
  onboardedAt?: string | null;
}

export const userApi = {
  search: async (search: string): Promise<UserSearchResult[]> =>
    (await apiClient.get<UserSearchResult[]>('/users', { params: { search } })).data,
  updateMe: async (input: ProfileInput): Promise<User> =>
    (await apiClient.patch<User>('/users/me', input)).data,
  /** Multipart upload — alternative to pasting an avatar URL (server field "file", max 2 MB). */
  uploadAvatar: async (file: File): Promise<User> => {
    const form = new FormData();
    form.append('file', file);
    return (await apiClient.post<User>('/users/me/avatar', form)).data;
  },
  changePassword: async (input: {
    currentPassword: string;
    newPassword: string;
  }): Promise<void> => {
    await apiClient.post('/auth/change-password', input);
  },
};
