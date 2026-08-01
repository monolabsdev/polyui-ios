import { afterEach, describe, expect, mock, test } from 'bun:test';

mock.module('expo-crypto', () => ({
  getRandomBytes: (length: number) => new Uint8Array(length),
  randomUUID: () => 'request-1',
}));
mock.module('@/security/session-crypto', () => ({
  createSessionKey: () => 'session-key',
  decryptSessionMessage: (payload: { plaintext: string }) => payload.plaintext,
  encryptSessionMessage: () => ({ nonce: '', ciphertext: '' }),
}));

const { relayRequest } = await import('@/network/relay-client');

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;

  constructor() {
    FakeWebSocket.instances.push(this);
  }

  close() {}
  send() {}
}

const originalWebSocket = globalThis.WebSocket;
const session = {
  relayUrl: 'https://relay.example.com',
  hostId: 'host-1',
  pairingToken: 'token',
  hostPublicKey: 'host-key',
  deviceSecretKey: 'device-secret',
  devicePublicKey: 'device-public',
};

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
  FakeWebSocket.instances = [];
});

describe('relay request timeout', () => {
  test('times out a stalled handshake', async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;

    await expect(relayRequest(
      session,
      { method: 'GET', path: '/status' },
      undefined,
      { handshake: 5, idle: 20 },
    )).rejects.toThrow('Relay handshake timed out.');
  });

  test('refreshes the idle deadline when a stream frame arrives', async () => {
    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
    const response = relayRequest(
      session,
      { method: 'GET', path: '/stream' },
      undefined,
      { handshake: 20, idle: 30 },
    );
    const socket = FakeWebSocket.instances[0];
    socket.onmessage?.({
      data: JSON.stringify({ type: 'ready', peerPublicKey: session.hostPublicKey }),
    });
    await Bun.sleep(20);
    socket.onmessage?.({
      data: JSON.stringify({
        type: 'frame',
        payload: {
          plaintext: JSON.stringify({ type: 'stream', id: 'request-1', data: 'ping' }),
        },
      }),
    });
    await Bun.sleep(20);

    await expect(Promise.race([response, Bun.sleep(1).then(() => 'still-running')]))
      .resolves.toBe('still-running');
    await expect(response).rejects.toThrow('Relay stream became idle.');
  });
});
