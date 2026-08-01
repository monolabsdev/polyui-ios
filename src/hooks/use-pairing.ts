import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { getNotificationsEnabled } from '@/data/settings-storage';
import { pairHost, syncHostConversations } from '@/network/poly-api';
import { syncNotificationRegistration } from '@/services/notifications';

export function usePairing(onDone?: () => void) {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const pairing = useRef(false);

  const scan = async (data: string) => {
    if (pairing.current) return;
    pairing.current = true;
    let pairedName: string | null = null;
    try {
      const host = await pairHost(data);
      pairedName = host.name;
      setMessage('Syncing chats…');
      if (getNotificationsEnabled()) {
        await syncNotificationRegistration(true).catch(() => undefined);
      }
      await syncHostConversations();
      await queryClient.invalidateQueries({ queryKey: ['agents'] });
      await queryClient.invalidateQueries({ queryKey: ['runtimes'] });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['conversation-sync'] });
      setMessage(`${host.name} paired.`);
      onDone?.();
    } catch (error) {
      if (pairedName) {
        setMessage(`${pairedName} paired. Chats will sync when the connection returns.`);
        await queryClient.invalidateQueries({ queryKey: ['agents'] });
        onDone?.();
      } else {
        setMessage(error instanceof Error ? error.message : 'This QR code is not a Poly host code.');
      }
    } finally {
      pairing.current = false;
    }
  };

  return { message, scan };
}
