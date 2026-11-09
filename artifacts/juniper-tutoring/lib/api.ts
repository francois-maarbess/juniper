import { Platform } from 'react-native';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';

const localWebApiOrigin = __DEV__ && Platform.OS === 'web' ? 'http://localhost:3001' : '';
const configuredOrigin = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') || localWebApiOrigin;
let currentAccessToken: string | null = null;

setBaseUrl(configuredOrigin || null);
setAuthTokenGetter(() => currentAccessToken);

export function setCurrentAccessToken(token: string | null) {
  currentAccessToken = token;
}

export function getCurrentAccessToken() {
  return currentAccessToken;
}

export function getApiOrigin() {
  return configuredOrigin;
}

export async function apiUpload<T>(path: string, form: FormData, accessToken: string | null) {
  const response = await fetch(`${configuredOrigin}/api${path}`, {
    method: 'POST', credentials: Platform.OS === 'web' ? 'include' : 'omit',
    headers: { Accept: 'application/json', 'X-Juniper-Client': Platform.OS === 'web' ? 'web' : 'native',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: form,
  });
  const payload = await response.json().catch(() => null) as ({ message?: string | string[] } & T) | null;
  if (!response.ok) {
    const message = payload && 'message' in payload ? Array.isArray(payload.message) ? payload.message.join(' ') : payload.message : 'The file could not be uploaded.';
    const error = new Error(message || 'The file could not be uploaded.') as ApiError;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}

export async function apiDownload(path: string, accessToken: string | null) {
  const response = await fetch(`${configuredOrigin}/api${path}`, {
    credentials: Platform.OS === 'web' ? 'include' : 'omit',
    headers: { Accept: '*/*', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    const error = new Error(payload?.message ?? 'The private file could not be opened.') as ApiError;
    error.status = response.status;
    throw error;
  }
  return { blob: await response.blob(), fileName: response.headers.get('content-disposition')?.match(/filename="([^"]+)/)?.[1] ?? 'tutor-document' };
}

export type ApiError = Error & { status?: number };

export async function apiRequest<T>(path: string, options: {
  method?: string; body?: unknown; accessToken?: string | null; credentials?: RequestCredentials;
} = {}): Promise<T> {
  const base = configuredOrigin || (Platform.OS === 'web' ? '' : '');
  if (!base && Platform.OS !== 'web') {
    throw new Error('Juniper cannot reach its API yet. Set EXPO_PUBLIC_API_URL to the API server address.');
  }
  const response = await fetch(`${base}/api${path}`, {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    credentials: options.credentials ?? (Platform.OS === 'web' ? 'include' : 'omit'),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Juniper-Client': Platform.OS === 'web' ? 'web' : 'native',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as { message?: string | string[] } | T | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? Array.isArray(payload.message) ? payload.message.join(' ') : payload.message
      : 'Something went wrong. Please try again.';
    const error = new Error(message || 'Something went wrong. Please try again.') as ApiError;
    error.status = response.status;
    throw error;
  }
  return payload as T;
}
