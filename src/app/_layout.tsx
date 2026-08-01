import '@/polyfills';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { initializeConversationCache } from '@/data/conversation-cache';
import { getNotificationsEnabled } from '@/data/settings-storage';
import {
  configureNotifications,
  listenForNotificationResponses,
  listenForPushTokenChanges,
  syncNotificationRegistration,
} from '@/services/notifications';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    void Promise.all([SplashScreen.hideAsync(), initializeConversationCache(), configureNotifications()]);
    void syncNotificationRegistration(getNotificationsEnabled()).catch(() => undefined);
    const notificationResponses = listenForNotificationResponses();
    const pushTokens = listenForPushTokenChanges();
    const appState = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
      if (state === 'active') {
        void syncNotificationRegistration(getNotificationsEnabled()).catch(() => undefined);
      }
    });
    return () => {
      notificationResponses.remove();
      pushTokens.remove();
      appState.remove();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
