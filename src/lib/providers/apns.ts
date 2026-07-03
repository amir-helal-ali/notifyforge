/**
 * APNs (Apple Push Notification service) HTTP/2 client.
 *
 * Sends push notifications to iOS devices via Apple's HTTP/2 Provider API.
 * Authenticates with a JWT (ES256) signed using the .p8 private key from
 * the Apple Developer portal.
 *
 * Env:
 *   APNS_KEY_ID      — 10-char key ID from Apple Developer portal
 *   APNS_TEAM_ID     — Apple Developer team ID
 *   APNS_BUNDLE_ID   — App bundle ID (used as apns-topic)
 *   APNS_PRIVATE_KEY — PEM-formatted ES256 private key (the .p8 contents)
 *   APNS_USE_SANDBOX — 'true' to use the sandbox endpoint
 *
 * Docs: https://developer.apple.com/documentation/usernotifications/setting_up_a_remote_notification_server/sending_notification_requests_to_apns
 */

import crypto from 'node:crypto';
import { logger } from '@/lib/infra/logger';

const PROD_HOST = 'api.push.apple.com';
const SANDBOX_HOST = 'api.sandbox.push.apple.com';

let cachedJwt: { token: string; expiresAt: number } | null = null;

function getApnsHost(): string {
  return process.env.APNS_USE_SANDBOX === 'true' ? SANDBOX_HOST : PROD_HOST;
}

function mintJwt(): string | null {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const privateKeyPem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!keyId || !teamId || !privateKeyPem) return null;

  if (cachedJwt && cachedJwt.expiresAt > Date.now() + 60_000) {
    return cachedJwt.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = { iss: teamId, iat: now };

  const base64url = (s: string) => Buffer.from(s).toString('base64url');
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const sign = crypto.createSign('SHA256');
  sign.update(unsigned);
  const signatureDer = sign.sign(privateKeyPem);
  // Convert DER signature to raw r||s (Apple requires raw ECDSA signatures)
  const rawSig = derToRawES256(signatureDer);
  const token = `${unsigned}.${rawSig.toString('base64url')}`;
  cachedJwt = { token, expiresAt: now * 1000 + 30 * 60 * 1000 }; // 30 min
  return token;
}

function derToRawES256(der: Buffer): Buffer {
  // DER format: 0x30 <len> 0x02 <r_len> <r> 0x02 <s_len> <s>
  if (der[0] !== 0x30) throw new Error('Invalid DER signature');
  let offset = 2;
  if (der[1] !== 0x30) offset = 2;
  if (der[offset] !== 0x02) throw new Error('Invalid DER: expected r marker');
  const rLen = der[offset + 1]!;
  const r = der.slice(offset + 2, offset + 2 + rLen);
  offset += 2 + rLen;
  if (der[offset] !== 0x02) throw new Error('Invalid DER: expected s marker');
  const sLen = der[offset + 1]!;
  const s = der.slice(offset + 2, offset + 2 + sLen);
  // Normalize to 32 bytes each
  const r32 = normalizeTo32(r);
  const s32 = normalizeTo32(s);
  return Buffer.concat([r32, s32]);
}

function normalizeTo32(buf: Buffer): Buffer {
  if (buf.length === 32) return buf;
  if (buf.length === 33 && buf[0] === 0) return buf.slice(1);
  if (buf.length < 32) {
    const padded = Buffer.alloc(32);
    buf.copy(padded, 32 - buf.length);
    return padded;
  }
  return buf.slice(buf.length - 32);
}

export interface ApnsSendResult {
  ok: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ApnsPayload {
  token: string;
  aps: Record<string, unknown>;
  pushType?: 'alert' | 'background' | 'location' | 'voip' | 'file' | 'mdm' | 'liveactivity';
  priority?: number;
  topic?: string;
  collapseId?: string;
  expiration?: number;
}

export async function sendApnsMessage(p: ApnsPayload): Promise<ApnsSendResult> {
  const jwt = mintJwt();
  if (!jwt) {
    return { ok: false, errorCode: 'not_configured', errorMessage: 'APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY all required' };
  }
  const topic = p.topic ?? process.env.APNS_BUNDLE_ID;
  if (!topic) {
    return { ok: false, errorCode: 'no_topic', errorMessage: 'topic or APNS_BUNDLE_ID required' };
  }
  const pushType = p.pushType ?? (p.aps['content-available'] === 1 ? 'background' : 'alert');
  const priority = p.priority ?? (pushType === 'background' ? 5 : 10);

  const path = `/3/device/${p.token}`;
  const host = getApnsHost();

  const headers: Record<string, string> = {
    ':method': 'POST',
    ':scheme': 'https',
    ':path': path,
    ':authority': host,
    authorization: `bearer ${jwt}`,
    'apns-push-type': pushType,
    'apns-priority': String(priority),
    'apns-topic': topic,
    'content-type': 'application/json',
  };
  if (p.collapseId) headers['apns-collapse-id'] = p.collapseId;
  if (p.expiration) headers['apns-expiration'] = String(p.expiration);

  // Use Node's native fetch (HTTP/1.1 fallback) — for true HTTP/2 in production,
  // use undici's Client or the `http2` module. Apple requires HTTP/2.
  // Here we use undici via global fetch which supports HTTP/2 in Node 18+.
  try {
    const res = await fetch(`https://${host}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ aps: p.aps }),
    });
    if (res.status === 200) {
      const messageId = res.headers.get('apns-id') ?? undefined;
      return { ok: true, messageId };
    }
    const text = await res.text();
    let errorCode = 'apns_error';
    let errorMessage = text;
    try {
      const json = JSON.parse(text);
      errorCode = json.reason ?? errorCode;
      errorMessage = json.reason ?? text;
    } catch {}
    return { ok: false, errorCode, errorMessage };
  } catch (e) {
    logger.error('apns.network_error', { error: (e as Error).message });
    return { ok: false, errorCode: 'network_error', errorMessage: (e as Error).message };
  }
}

export function isApnsConfigured(): boolean {
  return !!(process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_PRIVATE_KEY);
}
