import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';

import { getNotificationsEnabled, getPushRegistration, setPushRegistration } from '@/data/settings-storage';
import { updateHostPushToken } from '@/network/poly-api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const notificationKinds = [
  'agent-completed',
  'approval-requested',
  'host-disconnected',
  'remote-desktop-online',
  'pairing-request',
] as const;

export async function configureNotifications() {
  await Promise.all(notificationKinds.map((kind) =>
    Notifications.setNotificationCategoryAsync(kind, [
      { identifier: 'open', buttonTitle: 'Open', options: { opensAppToForeground: true } },
    ]),
  ));
}

export async function requestNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return current;
  }
  return Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
}

export async function syncNotificationRegistration(enabled: boolean): Promise<boolean> {
  await configureNotifications();
  const previous = getPushRegistration();
  if (!enabled) {
    if (previous) await updateHostPushToken(previous.token, previous.environment, false);
    setPushRegistration(null);
    return false;
  }

  const permission = await requestNotificationPermission();
  if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return false;
  }
  const token = await Notifications.getDevicePushTokenAsync();
  if (token.type !== 'ios' || typeof token.data !== 'string') {
    throw new Error('APNs is only available in the signed iOS app.');
  }
  await registerDeviceToken(token.data);
  return true;
}

export function listenForPushTokenChanges() {
  return Notifications.addPushTokenListener((token) => {
    if (getNotificationsEnabled() && token.type === 'ios' && typeof token.data === 'string') {
      void registerDeviceToken(token.data).catch(() => undefined);
    }
  });
}

async function registerDeviceToken(token: string): Promise<void> {
  const serviceEnvironment = await Application.getIosPushNotificationServiceEnvironmentAsync();
  if (!serviceEnvironment) throw new Error('APNs requires a signed app on a physical iPhone.');
  const environment = serviceEnvironment === 'development' ? 'sandbox' : 'production';
  const previous = getPushRegistration();
  await updateHostPushToken(token, environment, true);
  setPushRegistration({ token, environment });
  if (previous && previous.token !== token) {
    await updateHostPushToken(previous.token, previous.environment, false);
  }
}
