/**
 * Crypto utilities — API key generation, hashing, HMAC signing.
 * Production: keys are generated with crypto.randomBytes and never stored
 * in plaintext. Only the keyPrefix is searchable; keyHash is compared via
 * timing-safe equality after SHA-256 hashing.
 */

import crypto from 'node:crypto';

const KEY_PREFIX = 'nf_live_'; // NotifyForge live key
const KEY_BYTES = 32;

export function generateApiKey(): { fullKey: string; keyPrefix: string; keyHash: string } {
  const raw = crypto.randomBytes(KEY_BYTES).toString('base64url');
  const fullKey = `${KEY_PREFIX}${raw}`;
  const keyPrefix = fullKey.slice(0, 16);
  const keyHash = hashApiKey(fullKey);
  return { fullKey, keyPrefix, keyHash };
}

export function hashApiKey(fullKey: string): string {
  return crypto.createHash('sha256').update(fullKey).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function hmacSign(secret: string, payload: string, algo: 'sha256' | 'sha1' = 'sha256'): string {
  return crypto.createHmac(algo, secret).update(payload).digest('hex');
}

export function hmacVerify(
  secret: string,
  payload: string,
  signature: string,
  algo: 'sha256' | 'sha1' = 'sha256',
): boolean {
  const expected = hmacSign(secret, payload, algo);
  return safeEqual(expected, signature);
}

export function randomId(prefix = ''): string {
  return `${prefix}${crypto.randomUUID()}`;
}

export function requestId(): string {
  return crypto.randomUUID();
}
