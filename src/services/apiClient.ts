import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import EncryptedStorage from 'react-native-encrypted-storage';
import type { AuthSession, ChildSummary, FacilityOption, Paged, VaccineOption } from '../shared/types';

const defaultApiBaseUrl = 'https://hospital-app-production-a073.up.railway.app';

export const apiClient = axios.create({
  // Railway's free/hobby tier can cold-start a sleeping backend on the first request after
  // a period of inactivity, which can take well over 15s - a low timeout here reads to the
  // user as "could not load X" for what's actually just a slow wake-up, not a real failure.
  baseURL: process.env.API_BASE_URL ?? defaultApiBaseUrl,
  timeout: 30000
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

export async function fetchFacilities() {
  return (await apiClient.get<Paged<FacilityOption>>('/api/facilities', { params: { pageSize: 200 } })).data.items;
}

export async function fetchFacility(id: string) {
  return (await apiClient.get<FacilityOption>(`/api/facilities/${id}`)).data;
}

type ChildSearchApiResult = {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  guardianId: string;
  guardian?: { fullName: string; phoneNumber: string } | null;
};

export async function searchChildren(params: { q?: string; phone?: string; facilityId?: string }) {
  const response = await apiClient.get<ChildSearchApiResult[]>('/api/children/search', { params });
  return response.data.map(item => ({
    id: item.id,
    firstName: item.firstName,
    middleName: item.middleName,
    lastName: item.lastName,
    dateOfBirth: item.dateOfBirth,
    sex: item.sex,
    guardianId: item.guardianId,
    guardianFullName: item.guardian?.fullName ?? null,
    guardianPhoneNumber: item.guardian?.phoneNumber ?? null
  })) as ChildSummary[];
}

export async function fetchVaccines() {
  return (await apiClient.get<VaccineOption[]>('/api/vaccines')).data;
}

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string; code?: string } } | undefined;
    return data?.error?.message ?? error.message;
  }

  return error instanceof Error ? error.message : 'Unexpected error.';
}
