import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { apiDownload, apiRequest, apiUpload, getCurrentAccessToken, setCurrentAccessToken } from '@/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const REFRESH_TOKEN_KEY = 'juniper.refresh.v1';

export type Account = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  emailVerifiedAt: string | null;
  activeRole: 'student' | 'tutor';
  signupRole: 'student' | 'tutor';
  isAdmin?: boolean;
};

type AuthResponse = { user: Account; accessToken: string; refreshToken?: string; expiresIn: number };
type AuthContextValue = {
  isLoaded: boolean;
  user: Account | null;
  signIn: (email: string, password: string) => Promise<Account>;
  signUp: (input: { email: string; password: string; firstName: string; lastName?: string; role: 'student' | 'tutor' }) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  resendVerification: (email: string) => Promise<string>;
  requestPasswordReset: (email: string) => Promise<string>;
  resetPassword: (token: string, password: string) => Promise<void>;
  signOut: (everywhere?: boolean) => Promise<void>;
  setActiveRole: (role: 'student' | 'tutor') => Promise<void>;
  refreshSession: () => Promise<boolean>;
  request: <T>(path: string, options?: { method?: string; body?: unknown }) => Promise<T>;
  upload: <T>(path: string, form: FormData) => Promise<T>;
  download: (path: string) => Promise<{ blob: Blob; fileName: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [user, setUser] = useState<Account | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const storeSession = useCallback(async (result: AuthResponse) => {
    setCurrentAccessToken(result.accessToken);
    setAccessToken(result.accessToken);
    setUser(result.user);
    if (Platform.OS !== 'web' && result.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, result.refreshToken);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const refreshToken = Platform.OS === 'web' ? undefined : await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
      if (Platform.OS !== 'web' && !refreshToken) return false;
      const result = await apiRequest<AuthResponse>('/auth/token/refresh', {
        method: 'POST', body: refreshToken ? { refreshToken } : {},
      });
      await storeSession(result);
      return true;
    } catch {
      if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined);
      setCurrentAccessToken(null);
      setAccessToken(null);
      setUser(null);
      return false;
    }
  }, [storeSession]);

  useEffect(() => {
    let active = true;
    void refreshSession().finally(() => {
      if (active) setIsLoaded(true);
    });
    return () => { active = false; };
  }, [refreshSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<AuthResponse>('/auth/sign-in', { body: { email, password } });
    await storeSession(result);
    return result.user;
  }, [storeSession]);

  const signUp = useCallback(async (input: { email: string; password: string; firstName: string; lastName?: string; role: 'student' | 'tutor' }) => {
    await apiRequest('/auth/sign-up', { body: input });
  }, []);

  const verifyEmail = useCallback(async (token: string) => {
    const result = await apiRequest<AuthResponse>('/auth/verify-email', { body: { token } });
    await storeSession(result);
  }, [storeSession]);

  const resendVerification = useCallback(async (email: string) => {
    const result = await apiRequest<{ message: string }>('/auth/verification/resend', { body: { email } });
    return result.message;
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const result = await apiRequest<{ message: string }>('/auth/password/forgot', { body: { email } });
    return result.message;
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    await apiRequest('/auth/password/reset', { body: { token, password } });
  }, []);

  const signOut = useCallback(async (everywhere = false) => {
    try {
      if (accessToken && Platform.OS !== 'web') {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId,
        }).catch(() => null);
        if (token) await apiRequest('/marketplace/push-tokens', {
          method: 'DELETE', body: { token: token.data }, accessToken,
        }).catch(() => undefined);
      }
      if (accessToken) await apiRequest(everywhere ? '/auth/sign-out-everywhere' : '/auth/sign-out', {
        method: 'POST', body: {}, accessToken,
      });
    } finally {
      if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      setCurrentAccessToken(null);
      setAccessToken(null);
      setUser(null);
    }
  }, [accessToken]);

  const setActiveRole = useCallback(async (role: 'student' | 'tutor') => {
    const result = await apiRequest<Account>('/auth/active-role', { method: 'PATCH', body: { role }, accessToken });
    setUser(result);
  }, [accessToken]);

  const request = useCallback(async <T,>(path: string, options?: { method?: string; body?: unknown }) => {
    try {
      return await apiRequest<T>(path, { ...options, accessToken });
    } catch (error) {
      if ((error as { status?: number }).status !== 401 || !await refreshSession()) throw error;
      return apiRequest<T>(path, { ...options, accessToken: getCurrentAccessToken() });
    }
  }, [accessToken, refreshSession, storeSession]);

  const upload = useCallback(async <T,>(path: string, form: FormData) => {
    try { return await apiUpload<T>(path, form, accessToken); }
    catch (error) {
      if ((error as { status?: number }).status !== 401 || !await refreshSession()) throw error;
      return apiUpload<T>(path, form, getCurrentAccessToken());
    }
  }, [accessToken, refreshSession]);
  const download = useCallback(async (path: string) => {
    try { return await apiDownload(path, accessToken); }
    catch (error) {
      if ((error as { status?: number }).status !== 401 || !await refreshSession()) throw error;
      return apiDownload(path, getCurrentAccessToken());
    }
  }, [accessToken, refreshSession]);

  const value = useMemo(() => ({
    isLoaded, user, signIn, signUp, verifyEmail, resendVerification, requestPasswordReset, resetPassword,
    signOut, setActiveRole, refreshSession, request, upload, download,
  }), [isLoaded, user, signIn, signUp, verifyEmail, resendVerification, requestPasswordReset, resetPassword, signOut, setActiveRole, refreshSession, request, upload, download]);

  useEffect(() => {
    if (!user || Platform.OS === 'web') return;
    let active = true;
    void (async () => {
      try {
        const permissions = await Notifications.getPermissionsAsync();
        const granted = permissions.granted || (await Notifications.requestPermissionsAsync()).granted;
        if (!granted || !active) return;
        const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) return;
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (active) await request('/marketplace/push-tokens', { body: { token, platform: Platform.OS } });
      } catch {
        // Push is an enhancement; the in-app inbox and live socket stay available.
      }
    })();
    return () => { active = false; };
  }, [user, request]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
