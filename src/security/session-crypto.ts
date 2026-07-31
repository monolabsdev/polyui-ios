import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

export type EncryptedMessage = { nonce: string; ciphertext: string };

export type SessionKeyPair = { secretKey: string; publicKey: string };

export function createSessionKeyPair(): SessionKeyPair {
  const secretKey = x25519.utils.randomSecretKey();
  return {
    secretKey: bytesToHex(secretKey),
    publicKey: bytesToHex(x25519.getPublicKey(secretKey)),
  };
}

export function createSessionKey(peerPublicKey: string, secretKey: string) {
  const sharedSecret = x25519.getSharedSecret(hexToBytes(secretKey), hexToBytes(peerPublicKey));
  return bytesToHex(hkdf(sha256, sharedSecret, undefined, utf8ToBytes('poly-session-v1'), 32));
}

export function encryptSessionMessage(message: string, sessionKey: string, nonce: Uint8Array): EncryptedMessage {
  const ciphertext = xchacha20poly1305(hexToBytes(sessionKey), nonce).encrypt(new TextEncoder().encode(message));
  return { nonce: bytesToHex(nonce), ciphertext: bytesToHex(ciphertext) };
}

export function decryptSessionMessage(payload: EncryptedMessage, sessionKey: string) {
  const plaintext = xchacha20poly1305(hexToBytes(sessionKey), hexToBytes(payload.nonce)).decrypt(hexToBytes(payload.ciphertext));
  return new TextDecoder().decode(plaintext);
}
