import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { getNotificationsEnabled } from '@/data/settings-storage';
import { pairHost } from '@/network/poly-api';
import { syncNotificationRegistration } from '@/services/notifications';

export function usePairing(onDone?: () => void) {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const scan = async (data: string) => {
    try {
      const host = await pairHost(data);
      if (getNotificationsEnabled()) {
        await syncNotificationRegistration(true).catch(() => undefined);
      }
      await queryClient.invalidateQueries({ queryKey: ['agents'] });
      await queryClient.invalidateQueries({ queryKey: ['runtimes'] });
      setMessage(`${host.name} paired.`);
      onDone?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This QR code is not a Poly host code.');
    }
  };

  return { message, scan };
}
