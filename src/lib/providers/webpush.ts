/**
 * Web Push (VAPID + RFC 8030/8291) client.
 *
 * Encrypts a payload with aes128gcm per RFC 8291 and POSTs it to the push
 * endpoint with TTL, Urgency, Topic headers. Authenticates with VAPID JWT.
 *
 * Env:
 *   WEBPUSH_VAPID_PUBLIC_KEY  — base64url-encoded P-256 public key
 *   WEBPUSH_VAPID_PRIVATE_KEY — base64url-encoded P-256 private key
 *   WEBPUSH_SUBJECT           — mailto: or https: URL for contact
 *
 * Docs: https://datatracker.ietf.org/doc/html8291
 *       https://datatracker.ietf.org/doc/html8292
 */

import crypto from 'node:crypto';
import { logger } from '@/lib/infra/logger';

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface WebPushMessage {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, unknown>;
  actions?: { action: string; title: string; icon?: string }[];
  tag?: string;
  requireInteraction?: boolean;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
  ttl?: number;
}

export interface WebPushResult {
  ok: boolean;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

function base64urlDecode(s: string): Buffer {
  const pad = s.length % 4;
  const b64 = s + '='.repeat(pad ? 4 - pad : 0);
  return Buffer.from(b64.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function base64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Encrypt payload using aes128gcm per RFC 8291.
 */
function encryptPayload(payload: Buffer, subscription: WebPushSubscription): Buffer {
  const clientPublicKey = base64urlDecode(subscription.keys.p256dh);
  const clientAuthSecret = base64urlDecode(subscription.keys.auth);

  // Generate server key pair (ECDH P-256)
  const serverEcdh = crypto.createECDH('prime256v1');
  serverEcdh.generateKeys();
  const serverPublicKey = serverEcdh.getPublicKey();
  const serverPrivateKey = serverEcdh.getPrivateKey();

  // Shared secret from ECDH
  const sharedSecret = serverEcdh.computeSecret(clientPublicKey);

  // IKM: combine shared secret with auth secret via HKDF
  const authInfo = Buffer.from('WebPush: info\0', 'utf8');
  const ikm = crypto.createHmac('sha256', clientAuthSecret)
    .update(sharedSecret)
    .digest();

  // HKDF to derive content encryption key (16 bytes) and nonce (12 bytes)
  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'utf8');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'utf8');
  const prk = crypto.createHmac('sha256', Buffer.alloc(0)).update(ikm).digest();
  const cek = hkdfExpand(prk, cekInfo, 16);
  const nonce = hkdfExpand(prk, nonceInfo, 12);

  // Build the header (RFC 8188)
  // header = server_pub_key (65 bytes) + salt (16 bytes) + record_size (4 bytes) + id_len (1 byte) + id (var)
  const salt = crypto.randomBytes(16);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  const keyId = serverPublicKey; // 65 bytes uncompressed P-256 public key

  const header = Buffer.concat([salt, recordSize, Buffer.from([keyId.length]), keyId]);

  // Padding: payload + 0x02 (last record marker)
  const padded = Buffer.concat([payload, Buffer.from([0x02])]);

  // Encrypt with AES-128-GCM
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(padded), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Final: header + encrypted + authTag (16 bytes)
  return Buffer.concat([header, encrypted, authTag]);
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const blocks: Buffer[] = [];
  let prev = Buffer.alloc(0);
  let i = 1;
  while (Buffer.concat(blocks).length < length) {
    const hmac = crypto.createHmac('sha256', prk);
    hmac.update(Buffer.concat([prev, info, Buffer.from([i])]));
    prev = hmac.digest();
    blocks.push(prev);
    i++;
  }
  return Buffer.concat(blocks).slice(0, length);
}

/**
 * Generate VAPID JWT for authentication.
 */
function mintVapidJwt(endpoint: string): string | null {
  const publicKeyB64 = process.env.WEBPUSH_VAPID_PUBLIC_KEY;
  const privateKeyB64 = process.env.WEBPUSH_VAPID_PRIVATE_KEY;
  const subject = process.env.WEBPUSH_SUBJECT ?? 'mailto:admin@notifyforge.dev';
  if (!publicKeyB64 || !privateKeyB64) return null;

  const privateKey = base64urlDecode(privateKeyB64);
  const origin = new URL(endpoint).origin;

  const header = { typ: 'JWT', alg: 'ES256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: origin,
    exp: now + 12 * 60 * 60,
    sub: subject,
  };

  const unsigned = `${base64urlEncode(Buffer.from(JSON.stringify(header)))}.${base64urlEncode(Buffer.from(JSON.stringify(payload)))}`;
  const sign = crypto.createSign('SHA256');
  sign.update(unsigned);
  const signatureDer = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${base64urlEncode(signatureDer)}`;
}

export async function sendWebPushMessage(
  subscription: WebPushSubscription,
  message: WebPushMessage,
): Promise<WebPushResult> {
  if (!process.env.WEBPUSH_VAPID_PUBLIC_KEY || !process.env.WEBPUSH_VAPID_PRIVATE_KEY) {
    return { ok: false, errorCode: 'not_configured', errorMessage: 'WEBPUSH_VAPID_PUBLIC_KEY and WEBPUSH_VAPID_PRIVATE_KEY required' };
  }

  const vapidJwt = mintVapidJwt(subscription.endpoint);
  if (!vapidJwt) {
    return { ok: false, errorCode: 'vapid_failed', errorMessage: 'Failed to mint VAPID JWT' };
  }

  const payload = encryptPayload(
    Buffer.from(JSON.stringify(message), 'utf8'),
    subscription,
  );

  try {
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        Authorization: `vapid t=${vapidJwt}, k=${process.env.WEBPUSH_VAPID_PUBLIC_KEY}`,
        TTL: String(message.ttl ?? 2419200),
        Urgency: message.urgency ?? 'normal',
        ...(message.tag ? { Topic: message.tag } : {}),
      },
      body: payload,
    });
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, statusCode: res.status };
    }
    const text = await res.text();
    return {
      ok: false,
      statusCode: res.status,
      errorCode: res.status === 410 ? 'subscription_expired' : 'webpush_error',
      errorMessage: text || `HTTP ${res.status}`,
    };
  } catch (e) {
    logger.error('webpush.network_error', { error: (e as Error).message });
    return { ok: false, errorCode: 'network_error', errorMessage: (e as Error).message };
  }
}

export function isWebPushConfigured(): boolean {
  return !!(process.env.WEBPUSH_VAPID_PUBLIC_KEY && process.env.WEBPUSH_VAPID_PRIVATE_KEY);
}
