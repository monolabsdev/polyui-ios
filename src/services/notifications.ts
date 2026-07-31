import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
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
