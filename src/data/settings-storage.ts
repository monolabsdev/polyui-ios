import 'expo-sqlite/localStorage/install';

const NOTIFICATIONS_KEY = 'poly.notifications-enabled';
const PUSH_REGISTRATION_KEY = 'poly.push-registration';

export type PushRegistration = {
  token: string;
  environment: 'sandbox' | 'production';
};

export function getNotificationsEnabled(): boolean {
  return localStorage.getItem(NOTIFICATIONS_KEY) === 'true';
}

export function setNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(NOTIFICATIONS_KEY, String(enabled));
}

export function getPushRegistration(): PushRegistration | null {
  const value = localStorage.getItem(PUSH_REGISTRATION_KEY);
  if (!value) return null;
  try {
    const registration = JSON.parse(value) as PushRegistration;
    return registration.token && ['sandbox', 'production'].includes(registration.environment)
      ? registration
      : null;
  } catch {
    return null;
  }
}

export function setPushRegistration(registration: PushRegistration | null): void {
  if (registration) localStorage.setItem(PUSH_REGISTRATION_KEY, JSON.stringify(registration));
  else localStorage.removeItem(PUSH_REGISTRATION_KEY);
}
