import assert from 'node:assert/strict';
import { x25519 } from '@noble/curves/ed25519.js';
import { bytesToHex } from '@noble/hashes/utils.js';

import { agentSchema, relayPairingPayloadSchema } from '../src/domain/poly';
import { createSessionKey, createSessionKeyPair, decryptSessionMessage, encryptSessionMessage } from '../src/security/session-crypto';

assert.equal(agentSchema.parse({
  id: 'host',
  name: 'Host',
  host: 'Mac mini',
  status: 'online',
  lastSeenAt: '2026-07-31T14:20:00.000Z',
}).status, 'online');

assert.throws(() => relayPairingPayloadSchema.parse({ hostId: 'host' }));

const alice = x25519.keygen();
const bob = x25519.keygen();
const aliceKey = createSessionKey(bytesToHex(bob.publicKey), bytesToHex(alice.secretKey));
const bobKey = createSessionKey(bytesToHex(alice.publicKey), bytesToHex(bob.secretKey));
const encrypted = encryptSessionMessage('session check', aliceKey, new Uint8Array(24).fill(7));
assert.equal(decryptSessionMessage(encrypted, bobKey), 'session check');

const relayAlice = createSessionKeyPair();
const relayBob = createSessionKeyPair();
const relayAliceKey = createSessionKey(relayBob.publicKey, relayAlice.secretKey);
const relayBobKey = createSessionKey(relayAlice.publicKey, relayBob.secretKey);
const relayEncrypted = encryptSessionMessage(JSON.stringify({ type: 'request' }), relayAliceKey, new Uint8Array(24).fill(9));
assert.equal(decryptSessionMessage(relayEncrypted, relayBobKey), JSON.stringify({ type: 'request' }));

console.log('domain schemas: ok');
