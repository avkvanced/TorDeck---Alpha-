import { useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation } from '@tanstack/react-query';
import { torboxApi } from '@/services/torbox-api';
import { TorBoxUser } from '@/types/torbox';

const TOKEN_KEY = 'torbox_api_token';

async function storeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function removeStoredToken(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<TorBoxUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getStoredToken();
        if (stored && !cancelled) {
          console.log('[Auth] Found stored token, validating...');
          torboxApi.setToken(stored);
          try {
            const userData = await torboxApi.getUser();
            if (!cancelled) {
              setToken(stored);
              setUser(userData);
              setIsConnected(true);
              console.log('[Auth] Token validated, user:', userData.email);
            }
          } catch {
            console.log('[Auth] Stored token invalid, clearing');
            await removeStoredToken();
          }
        }
      } catch (err) {
        console.error('[Auth] Init error:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return null;
    const latestUser = await torboxApi.getUser();
    setUser(latestUser);
    return latestUser;
  }, [token]);

  useEffect(() => {
    if (!isConnected || !token) return;
    const interval = setInterval(() => {
      refreshUser().catch((err) => {
        console.warn('[Auth] Failed to refresh user stats:', err);
      });
    }, 120000);

    return () => clearInterval(interval);
  }, [isConnected, token, refreshUser]);

  const connectMutation = useMutation({
    mutationFn: async (apiToken: string) => {
      torboxApi.setToken(apiToken);
      const userData = await torboxApi.getUser();
      await storeToken(apiToken);
      return { token: apiToken, user: userData };
    },
    onSuccess: (data) => {
      setToken(data.token);
      setUser(data.user);
      setIsConnected(true);
      console.log('[Auth] Connected as:', data.user.email);
    },
    onError: (err) => {
      console.error('[Auth] Connect error:', err);
      torboxApi.setToken('');
    },
  });

  const disconnect = useCallback(async () => {
    await removeStoredToken();
    torboxApi.setToken('');
    setToken(null);
    setUser(null);
    setIsConnected(false);
    console.log('[Auth] Disconnected');
  }, []);

  return {
    token,
    user,
    isLoading,
    isConnected,
    connect: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    connectError: connectMutation.error?.message ?? null,
    disconnect,
    refreshUser,
  };
});
