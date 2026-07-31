import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { ed25519 } from '@noble/curves/ed25519.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

const identityKey = 'poly.device.identity.v1';

type StoredIdentity = {
  secretKey: string;
  publicKey: string;
};

export async function getOrCreateDeviceIdentity(): Promise<StoredIdentity> {
  const stored = await SecureStore.getItemAsync(identityKey);
  if (stored) return JSON.parse(stored) as StoredIdentity;

  const seed = await Crypto.getRandomBytesAsync(32);
  const secretKey = ed25519.utils.randomSecretKey(seed);
  const identity = {
    secretKey: bytesToHex(secretKey),
    publicKey: bytesToHex(ed25519.getPublicKey(secretKey)),
  };

  await SecureStore.setItemAsync(identityKey, JSON.stringify(identity), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return identity;
}

export async function authenticateDevice() {
  const available = await LocalAuthentication.hasHardwareAsync();
  if (!available) return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Poly',
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function rotateDeviceIdentity() {
  await SecureStore.deleteItemAsync(identityKey);
  return getOrCreateDeviceIdentity();
}

export function signDeviceMessage(message: string, secretKey: string) {
  return bytesToHex(ed25519.sign(new TextEncoder().encode(message), hexToBytes(secretKey)));
}
