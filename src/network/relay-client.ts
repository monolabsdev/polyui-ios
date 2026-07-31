import * as Crypto from 'expo-crypto';

import {
  decryptSessionMessage,
  createSessionKey,
  encryptSessionMessage,
  type EncryptedMessage,
} from '@/security/session-crypto';

export type RelaySession = {
  relayUrl: string;
  hostId: string;
  pairingToken: string;
  hostPublicKey: string;
  deviceSecretKey: string;
  devicePublicKey: string;
};

type RelayResponse = { status: number; body: string };

function websocketUrl(value: string) {
  const url = new URL(value);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws';
  url.search = '';
  return url.toString();
}

export function relayRequest(
  session: RelaySession,
  request: { method: string; path: string; body?: string },
  onStream?: (data: string) => void,
): Promise<RelayResponse> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(websocketUrl(session.relayUrl));
    const requestId = Crypto.randomUUID();
    let sessionKey: string | undefined;
    let finished = false;

    const finish = (callback: () => void) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      socket.close();
      callback();
    };

    const timeout = setTimeout(
      () => finish(() => reject(new Error('Relay request timed out.'))),
      30_000,
    );

    socket.onerror = () => finish(() => reject(new Error('Could not reach Poly relay.')));
    socket.onclose = () => {
      if (!finished) finish(() => reject(new Error('Relay connection closed.')));
    };
    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: 'register',
        role: 'client',
        hostId: session.hostId,
        pairingToken: session.pairingToken,
        publicKey: session.devicePublicKey,
      }));
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as {
        type: string;
        peerPublicKey?: string;
        payload?: EncryptedMessage;
      };
      if (message.type === 'error') {
        finish(() => reject(new Error('Host is offline.')));
        return;
      }
      if (message.type === 'ready' && message.peerPublicKey) {
        if (message.peerPublicKey !== session.hostPublicKey) {
          finish(() => reject(new Error('Relay host identity changed.')));
          return;
        }
        sessionKey = createSessionKey(message.peerPublicKey, session.deviceSecretKey);
        socket.send(JSON.stringify({
          type: 'frame',
          payload: encryptSessionMessage(JSON.stringify({
            type: 'request',
            id: requestId,
            method: request.method,
            path: request.path,
            body: request.body,
          }), sessionKey, new Uint8Array(Crypto.getRandomBytes(24))),
        }));
        return;
      }
      if (message.type !== 'frame' || !message.payload || !sessionKey) return;
      const response = JSON.parse(decryptSessionMessage(message.payload, sessionKey)) as {
        type: string;
        id: string;
        status?: number;
        body?: string;
        data?: string;
      };
      if (response.id !== requestId) return;
      if (response.type === 'stream') {
        onStream?.(response.data ?? '');
      } else if (response.type === 'stream-end') {
        finish(() => resolve({ status: 200, body: '' }));
      } else if (response.type === 'response') {
        finish(() => resolve({ status: response.status ?? 500, body: response.body ?? '' }));
      }
    };
  });
}
