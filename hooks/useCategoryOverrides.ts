import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { MediaCategory, CategoryOverride } from '@/types/torbox';

const OVERRIDES_KEY = 'category_overrides';

export const [CategoryOverrideProvider, useCategoryOverrides] = createContextHook(() => {
  const [overrides, setOverrides] = useState<Record<string, CategoryOverride>>({});
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(OVERRIDES_KEY);
        if (stored) {
          setOverrides(JSON.parse(stored));
          console.log('[CategoryOverrides] Loaded overrides');
        }
      } catch (err) {
        console.error('[CategoryOverrides] Load error:', err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const persistOverrides = useCallback(async (newOverrides: Record<string, CategoryOverride>) => {
    try {
      await AsyncStorage.setItem(OVERRIDES_KEY, JSON.stringify(newOverrides));
    } catch (err) {
      console.error('[CategoryOverrides] Save error:', err);
    }
  }, []);

  const setOverride = useCallback(async (itemId: string, originalCategory: MediaCategory, newCategory: MediaCategory) => {
    const updated = { ...overrides };
    if (newCategory === originalCategory) {
      delete updated[itemId];
    } else {
      updated[itemId] = {
        itemId,
        originalCategory,
        overrideCategory: newCategory,
        updatedAt: new Date().toISOString(),
      };
    }
    setOverrides(updated);
    await persistOverrides(updated);
    console.log('[CategoryOverrides] Set override:', itemId, '->', newCategory);
  }, [overrides, persistOverrides]);

  const setBulkOverride = useCallback(async (itemIds: string[], originalCategories: Record<string, MediaCategory>, newCategory: MediaCategory) => {
    const updated = { ...overrides };
    for (const itemId of itemIds) {
      const original = originalCategories[itemId];
      if (newCategory === original) {
        delete updated[itemId];
      } else {
        updated[itemId] = {
          itemId,
          originalCategory: original,
          overrideCategory: newCategory,
          updatedAt: new Date().toISOString(),
        };
      }
    }
    setOverrides(updated);
    await persistOverrides(updated);
    console.log('[CategoryOverrides] Bulk override:', itemIds.length, 'items ->', newCategory);
  }, [overrides, persistOverrides]);

  const resetOverride = useCallback(async (itemId: string) => {
    const updated = { ...overrides };
    delete updated[itemId];
    setOverrides(updated);
    await persistOverrides(updated);
    console.log('[CategoryOverrides] Reset override:', itemId);
  }, [overrides, persistOverrides]);

  const resetBulkOverrides = useCallback(async (itemIds: string[]) => {
    const updated = { ...overrides };
    for (const itemId of itemIds) {
      delete updated[itemId];
    }
    setOverrides(updated);
    await persistOverrides(updated);
    console.log('[CategoryOverrides] Reset bulk overrides:', itemIds.length, 'items');
  }, [overrides, persistOverrides]);

  const getEffectiveCategory = useCallback((itemId: string, autoCategory: MediaCategory): MediaCategory => {
    const override = overrides[itemId];
    return override ? override.overrideCategory : autoCategory;
  }, [overrides]);

  const overrideCount = useMemo(() => Object.keys(overrides).length, [overrides]);

  return {
    overrides,
    isLoaded,
    setOverride,
    setBulkOverride,
    resetOverride,
    resetBulkOverrides,
    getEffectiveCategory,
    overrideCount,
  };
});
