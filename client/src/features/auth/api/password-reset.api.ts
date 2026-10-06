import { apiClient } from '@/lib/api-client';

/**
 * §11 password reset. `forgot` always answers 204 — the UI must not reveal
 * whether the email exists either. The email link points at /reset-password?token=…
 */
export const passwordResetApi = {
  forgot: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email });
  },
  reset: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/reset-password', { token, newPassword });
  },
};
