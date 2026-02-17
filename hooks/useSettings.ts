import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { DefaultTab } from '@/types/torbox';

const SETTINGS_KEY = 'app_settings';

interface AppSettings {
  defaultTab: DefaultTab;
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultTab: '(library)',
};

export const [SettingsProvider, useSettings] = createContextHook(() => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (err) {
        console.error('[Settings] Load error:', err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      console.log('[Settings] Saved:', newSettings);
    } catch (err) {
      console.error('[Settings] Save error:', err);
    }
  }, [settings]);

  return {
    settings,
    isLoaded,
    updateSettings,
  };
});
