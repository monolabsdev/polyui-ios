import 'expo-sqlite/localStorage/install';

const NOTIFICATIONS_KEY = 'poly.notifications-enabled';
const PUSH_REGISTRATION_KEY = 'poly.push-registration';
const ON_DEVICE_MODEL_KEY = 'poly.on-device-model';
const ON_DEVICE_MODE_KEY = 'poly.on-device-mode';

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

export function getOnDeviceModelId(): string | null {
  return localStorage.getItem(ON_DEVICE_MODEL_KEY);
}

export function setOnDeviceModelId(modelId: string | null): void {
  if (modelId) localStorage.setItem(ON_DEVICE_MODEL_KEY, modelId);
  else localStorage.removeItem(ON_DEVICE_MODEL_KEY);
}

export function getOnDeviceMode(): boolean {
  return localStorage.getItem(ON_DEVICE_MODE_KEY) === 'true';
}

export function setOnDeviceMode(enabled: boolean): void {
  localStorage.setItem(ON_DEVICE_MODE_KEY, String(enabled));
}
