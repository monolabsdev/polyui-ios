import { useState } from 'react';

import { getNotificationsEnabled, setNotificationsEnabled } from '@/data/settings-storage';
import { syncNotificationRegistration } from '@/services/notifications';

export function useNotificationsPreference() {
  const [enabled, setEnabled] = useState(getNotificationsEnabled);

  const enable = async (value: boolean) => {
    setEnabled(value);
    setNotificationsEnabled(value);
    try {
      const registered = await syncNotificationRegistration(value);
      if (value && !registered) {
        setEnabled(false);
        setNotificationsEnabled(false);
      }
    } catch {
      // Keep the preference enabled; foreground sync retries transient host/APNs failures.
    }
  };

  return { enabled, enable };
}
