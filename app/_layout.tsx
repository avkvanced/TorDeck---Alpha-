import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/hooks/useAuth";
import { LibraryProvider } from "@/hooks/useLibrary";
import { SettingsProvider } from "@/hooks/useSettings";
import { CategoryOverrideProvider } from "@/hooks/useCategoryOverrides";
import { AutomationsProvider } from "@/hooks/useAutomations";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="connect" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen
        name="add-content"
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="audiobook-detail"
        options={{
          title: "Audiobook",
          headerStyle: { backgroundColor: Colors.surface },
        }}
      />
      <Stack.Screen
        name="item/[id]"
        options={{
          title: "Details",
          headerStyle: { backgroundColor: Colors.surface },
        }}
      />
      <Stack.Screen
        name="download-detail"
        options={{
          title: "Download",
          headerStyle: { backgroundColor: Colors.surface },
        }}
      />
    </Stack>
  );
}

function useWebStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const isStandalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches;

    const style = document.createElement('style');
    style.textContent = `
      html, body, #root {
        background-color: ${Colors.background};
        overscroll-behavior: none;
      }
      [role="button"], button, a, [data-testid] { cursor: pointer !important; }
      input, textarea { outline: none; }
      * { -webkit-tap-highlight-color: transparent; }
      ${isStandalone ? `
        input, textarea {
          -webkit-user-select: text;
          user-select: text;
        }
      ` : ''}
    `;
    document.head.appendChild(style);

    if (isStandalone) {
      console.log('[PWA] Running in standalone mode');
    }

    return () => { document.head.removeChild(style); };
  }, []);
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  useWebStyles();

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
        <AuthProvider>
          <SettingsProvider>
            <CategoryOverrideProvider>
              <AutomationsProvider>
                <LibraryProvider>
                  <RootLayoutNav />
                </LibraryProvider>
              </AutomationsProvider>
            </CategoryOverrideProvider>
          </SettingsProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
