/**
 * FCM (Firebase Cloud Messaging) HTTP v1 client.
 *
 * Sends push notifications to Android devices via Google's FCM v1 API.
 * Authenticates with an OAuth2 access token minted from a service account
 * JSON key using a self-signed JWT (RS256).
 *
 * Env:
 *   FCM_SERVICE_ACCOUNT_JSON — JSON string of the service account key file
 *   FCM_PROJECT_ID           — Firebase project ID (optional; extracted from JSON if absent)
 *
 * Docs: https://firebase.google.com/docs/cloud-messaging/http-server-ref
 */

import crypto from 'node:crypto';
import { logger } from '@/lib/infra/logger';

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri: string;
}

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_ENDPOINT = (projectId: string) => `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

let cachedServiceAccount: ServiceAccount | null = null;
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccount | null {
  if (cachedServiceAccount) return cachedServiceAccount;
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    cachedServiceAccount = JSON.parse(raw) as ServiceAccount;
    return cachedServiceAccount;
  } catch (e) {
    logger.error('fcm.invalid_service_account', { error: (e as Error).message });
    return null;
  }
}

/**
 * Mint an OAuth2 access token from the service account using a self-signed JWT (RS256).
 * Implements Google's JWT flow without external dependencies.
 */
async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }
  const sa = loadServiceAccount();
  if (!sa) return null;

  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { alg: 'RS256', typ: 'JWT' };
  const jwtClaim = {
    iss: sa.client_email,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };

  const base64url = (s: string) => Buffer.from(s).toString('base64url');
  const unsigned = `${base64url(JSON.stringify(jwtHeader))}.${base64url(JSON.stringify(jwtClaim))}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(sa.private_key.replace(/\\n/g, '\n'), 'base64url');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    logger.error('fcm.token_failed', { status: res.status, body: text });
    return null;
  }
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedAccessToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export interface FcmSendResult {
  ok: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Send a real FCM v1 message.
 * If no service account is configured, returns ok=false with code='not_configured'.
 */
export async function sendFcmMessage(message: {
  token?: string;
  tokens?: string[];
  notification?: { title: string; body: string };
  data?: Record<string, string>;
  android?: Record<string, unknown>;
  fcmOptions?: Record<string, unknown>;
}): Promise<FcmSendResult> {
  const sa = loadServiceAccount();
  if (!sa) {
    return { ok: false, errorCode: 'not_configured', errorMessage: 'FCM_SERVICE_ACCOUNT_JSON not set' };
  }
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { ok: false, errorCode: 'auth_failed', errorMessage: 'Failed to mint OAuth2 access token' };
  }

  // FCM v1 unicast: one message per token. Multicast = batch of unicast.
  const tokens = message.tokens ?? (message.token ? [message.token] : []);
  if (tokens.length === 0) {
    return { ok: false, errorCode: 'no_tokens', errorMessage: 'No device tokens provided' };
  }

  // For a single token, use the standard endpoint.
  if (tokens.length === 1) {
    const body = {
      message: {
        token: tokens[0],
        notification: message.notification,
        data: message.data,
        android: message.android,
        fcmOptions: message.fcmOptions,
      },
    };
    try {
      const res = await fetch(FCM_ENDPOINT(sa.project_id), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          errorCode: data?.error?.details?.[0]?.errorCode ?? 'fcm_error',
          errorMessage: data?.error?.message ?? `HTTP ${res.status}`,
        };
      }
      return { ok: true, messageId: data.name };
    } catch (e) {
      return { ok: false, errorCode: 'network_error', errorMessage: (e as Error).message };
    }
  }

  // Multicast: send each one (FCM v1 doesn't have a native multicast API; use batchSend or iterate).
  // For production scale, use Firebase Admin SDK's sendEachForMulticast.
  const results: FcmSendResult[] = await Promise.all(
    tokens.map((t) => sendFcmMessage({
      token: t,
      notification: message.notification,
      data: message.data,
      android: message.android,
      fcmOptions: message.fcmOptions,
    })),
  );
  const firstOk = results.find((r) => r.ok);
  if (firstOk) return firstOk;
  return results[0]!;
}

/**
 * Check if FCM is configured.
 */
export function isFcmConfigured(): boolean {
  return loadServiceAccount() !== null;
}
