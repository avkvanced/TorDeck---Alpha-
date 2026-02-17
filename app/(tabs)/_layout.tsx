import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Tabs, Redirect, useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Library, Download, BarChart3, Settings, Zap } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';

const TAB_ROUTES: Record<string, string> = {
  '(library)': '/(tabs)/(library)',
  'automations': '/(tabs)/automations',
  'downloads': '/(tabs)/downloads',
  'stats': '/(tabs)/stats',
  'settings': '/(tabs)/settings',
};

export default function TabLayout() {
  const { isConnected, isLoading } = useAuth();
  const { settings, isLoaded: settingsLoaded } = useSettings();
  const router = useRouter();
  const hasRedirected = useRef<boolean>(false);
  const segments = useSegments();

  useEffect(() => {
    if (!settingsLoaded || hasRedirected.current || !isConnected) return;
    const defaultTab = settings.defaultTab;
    if (defaultTab && defaultTab !== '(library)') {
      const route = TAB_ROUTES[defaultTab];
      if (route) {
        hasRedirected.current = true;
        setTimeout(() => {
          router.replace(route as any);
        }, 50);
      }
    } else {
      hasRedirected.current = true;
    }
  }, [settingsLoaded, isConnected, settings.defaultTab, router]);

  if (isLoading) return null;
  if (!isConnected) return <Redirect href={'/connect' as any} />;

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <Tabs
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: Colors.tabBar,
              borderTopColor: Colors.border,
              borderTopWidth: 0.5,
              elevation: 0,
              shadowOpacity: 0,
              ...(Platform.OS === 'web'
                ? {
                    paddingBottom: Math.max(insets.bottom, 8),
                    height: 56 + Math.max(insets.bottom, 8),
                  }
                : Platform.OS === 'ios'
                  ? {
                      paddingBottom: Math.max(insets.bottom - 8, 4),
                      height: 52 + Math.max(insets.bottom - 8, 4),
                    }
                  : {
                      paddingBottom: 6,
                      height: 58,
                    }),
            },
            tabBarActiveTintColor: Colors.primary,
            tabBarInactiveTintColor: Colors.textTertiary,
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '600' as const,
              letterSpacing: 0.2,
            },
          }}
        >
          <Tabs.Screen
            name="(library)"
            options={{
              title: 'Library',
              tabBarIcon: ({ color, size }) => <Library size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="automations"
            options={{
              title: 'Automations',
              tabBarIcon: ({ color, size }) => <Zap size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="downloads"
            options={{
              title: 'Downloads',
              tabBarIcon: ({ color, size }) => <Download size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="stats"
            options={{
              title: 'Stats',
              tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
              tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
            }}
          />
          <Tabs.Screen
            name="download-detail"
            options={{
              href: null,
            }}
          />
          <Tabs.Screen
            name="item/[id]"
            options={{
              href: null,
            }}
          />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
