import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
  // Auth uses httpOnly cookies set by the API; never store tokens in JS-accessible storage.
  withCredentials: true,
});

/** Error shape returned by the API: { error: { code, message, details, requestId } } */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown };
}

export function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof AxiosError) {
    if (!err.response) return new ApiError(0, 'NETWORK_ERROR', err.message);
    const body = err.response.data as ApiErrorBody | undefined;
    return new ApiError(
      err.response.status,
      body?.error?.code ?? 'UNKNOWN_ERROR',
      body?.error?.message ?? err.message,
      body?.error?.details,
    );
  }
  return new ApiError(0, 'UNKNOWN_ERROR', err instanceof Error ? err.message : String(err));
}

// ---- Silent session refresh -------------------------------------------------------------

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];
let refreshInFlight: Promise<void> | null = null;
const unauthorizedListeners = new Set<() => void>();

/** Called when the session cannot be refreshed (user must sign in again). */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

/** One refresh for all concurrent 401s (single-flight). */
function refreshSession(): Promise<void> {
  refreshInFlight ??= apiClient
    .post('/auth/refresh')
    .then(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const config = error instanceof AxiosError ? (error.config as RetriableConfig | undefined) : undefined;
    const isAuthEndpoint = AUTH_ENDPOINTS.some((path) => config?.url?.startsWith(path));
    const is401 = error instanceof AxiosError && error.response?.status === 401;

    if (!is401 || !config || config._retried || isAuthEndpoint) {
      throw normalizeError(error);
    }

    config._retried = true;
    try {
      await refreshSession();
    } catch (refreshError) {
      // Another tab rotated the token a moment ago — its new cookies are already ours, so retry.
      if (normalizeError(refreshError).code !== 'REFRESH_TOKEN_REUSED') {
        unauthorizedListeners.forEach((listener) => listener());
        throw normalizeError(error);
      }
    }
    return apiClient(config);
  },
);
