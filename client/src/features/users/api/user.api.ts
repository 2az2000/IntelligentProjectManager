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
}

export const userApi = {
  search: async (search: string): Promise<UserSearchResult[]> =>
    (await apiClient.get<UserSearchResult[]>('/users', { params: { search } })).data,
  updateMe: async (input: ProfileInput): Promise<User> =>
    (await apiClient.patch<User>('/users/me', input)).data,
  changePassword: async (input: { currentPassword: string; newPassword: string }): Promise<void> => {
    await apiClient.post('/auth/change-password', input);
  },
};
