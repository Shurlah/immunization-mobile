import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import type { AuthSession } from '../shared/types';

const defaultApiBaseUrl = Platform.select({
  android: 'http://10.0.2.2:35299',
  default: 'http://127.0.0.1:35299'
});

export const apiClient = axios.create({
  baseURL: process.env.API_BASE_URL ?? defaultApiBaseUrl,
  timeout: 15000
});

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<AuthSession> | null = null;

export async function saveSession(session: AuthSession) {
  await EncryptedStorage.setItem('session', JSON.stringify(session));
  apiClient.defaults.headers.common.Authorization = `Bearer ${session.accessToken}`;
}

export async function loadSession() {
  const raw = await EncryptedStorage.getItem('session');
  if (!raw) return null;
  const session = JSON.parse(raw) as AuthSession;
  apiClient.defaults.headers.common.Authorization = `Bearer ${session.accessToken}`;
  return session;
}

export async function clearSession() {
  await EncryptedStorage.removeItem('session');
  delete apiClient.defaults.headers.common.Authorization;
}

export async function logout() {
  const raw = await EncryptedStorage.getItem('session');

  try {
    if (raw) {
      const session = JSON.parse(raw) as AuthSession;
      await apiClient.post('/api/auth/logout', { refreshToken: session.refreshToken });
    }
  } catch {
    // Local logout must still succeed if the server token is already expired/revoked.
  }

  await clearSession();
}

async function refreshSession() {
  const raw = await EncryptedStorage.getItem('session');
  if (!raw) throw new Error('Session expired. Sign in again.');

  const session = JSON.parse(raw) as AuthSession;
  const response = await apiClient.post<AuthSession>('/api/auth/refresh-token', {
    refreshToken: session.refreshToken
  });
  await saveSession(response.data);
  return response.data;
}

apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const config = error.config as RetryableRequestConfig | undefined;
    const status = error.response?.status;
    const url = config?.url ?? '';

    if (!config || status !== 401 || config._retry || url.includes('/api/auth/login') || url.includes('/api/auth/refresh-token')) {
      return Promise.reject(error);
    }

    config._retry = true;
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });

    const session = await refreshPromise;
    config.headers.Authorization = `Bearer ${session.accessToken}`;
    return apiClient(config);
  }
);

export async function login(email: string, password: string) {
  const response = await apiClient.post<AuthSession>('/api/auth/login', { email, password });
  await saveSession(response.data);
  return response.data;
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string; code?: string } } | undefined;
    return data?.error?.message ?? error.message;
  }

  return error instanceof Error ? error.message : 'Unexpected error.';
}
