import { apiClient, normalizeError } from '@/lib/api-client';
import type { User } from '../types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  name: string;
}

export const authApi = {
  /** The current user, or null when not signed in. */
  me: async (): Promise<User | null> => {
    try {
      return (await apiClient.get<User>('/auth/me')).data;
    } catch (err) {
      if (normalizeError(err).status === 401) return null;
      throw err;
    }
  },
  login: async (input: LoginInput): Promise<User> =>
    (await apiClient.post<User>('/auth/login', input)).data,
  register: async (input: RegisterInput): Promise<User> =>
    (await apiClient.post<User>('/auth/register', input)).data,
  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
