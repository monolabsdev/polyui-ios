import { useCallback } from 'react';

import { authenticateDevice } from '@/security/device-identity';
import { useAppStore } from '@/state/app-store';

export function useHostReveal() {
  const revealed = useAppStore((state) => state.hostRevealed);
  const setHostRevealed = useAppStore((state) => state.setHostRevealed);

  const reveal = useCallback(async () => {
    if (useAppStore.getState().hostRevealed) return;
    if (await authenticateDevice()) setHostRevealed(true);
  }, [setHostRevealed]);

  return { revealed, reveal };
}
