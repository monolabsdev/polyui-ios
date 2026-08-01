import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import { Alert } from 'react-native';
import { z } from 'zod';

import { getNotificationsEnabled, getPushRegistration, setPushRegistration } from '@/data/settings-storage';
import { approveHostRequest, updateHostPushToken } from '@/network/poly-api';

const approvalNotificationSchema = z.object({
  kind: z.literal('approval-requested'),
  requestId: z.string().min(1),
  approvalId: z.string().min(1),
  action: z.string().min(1),
  command: z.string().nullish().transform((value) => value ?? undefined),
  paths: z.array(z.string()).optional(),
  cwd: z.string().nullish().transform((value) => value ?? undefined),
});
const handledResponses = new Set<string>();
const foregroundApprovals = new Set<string>();

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const approval = approvalNotificationSchema.safeParse(notification.request.content.data);
    const isVisibleInApp = approval.success
      && foregroundApprovals.has(approval.data.approvalId);
    return {
      shouldPlaySound: !isVisibleInApp,
      shouldSetBadge: !isVisibleInApp,
      shouldShowBanner: !isVisibleInApp,
      shouldShowList: !isVisibleInApp,
    };
  },
});

export const notificationKinds = [
  'agent_completed',
  'host_disconnected',
  'remote_desktop_online',
  'pairing_request',
] as const;

export async function configureNotifications() {
  await Promise.all([
    ...notificationKinds.map((kind) => Notifications.setNotificationCategoryAsync(kind, [
      { identifier: 'open', buttonTitle: 'Open', options: { opensAppToForeground: true } },
    ])),
    Notifications.setNotificationCategoryAsync('approval_requested', [
      {
        identifier: 'approve',
        buttonTitle: 'Allow',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'deny',
        buttonTitle: 'Deny',
        options: { isDestructive: true, opensAppToForeground: true },
      },
    ]),
  ]);
}

export function beginForegroundApproval(approvalId: string) {
  if (foregroundApprovals.has(approvalId)) return null;
  foregroundApprovals.add(approvalId);
  return () => {
    foregroundApprovals.delete(approvalId);
  };
}

export function listenForNotificationResponses() {
  const handle = (response: Notifications.NotificationResponse) => {
    if (!['approve', 'deny'].includes(response.actionIdentifier)) return;
    const approval = approvalNotificationSchema.safeParse(response.notification.request.content.data);
    if (!approval.success) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handledResponses.has(key)) return;
    handledResponses.add(key);
    void approveHostRequest(approval.data, response.actionIdentifier === 'approve')
      .then(() => Notifications.clearLastNotificationResponse())
      .catch((cause: unknown) => {
        handledResponses.delete(key);
        Alert.alert(
          'Could not answer approval',
          cause instanceof Error ? cause.message : 'Open Poly and try again.',
        );
      });
  };

  const lastResponse = Notifications.getLastNotificationResponse();
  if (lastResponse) handle(lastResponse);
  return Notifications.addNotificationResponseReceivedListener(handle);
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
