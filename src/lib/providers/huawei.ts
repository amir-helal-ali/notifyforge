/**
 * Huawei HMS Push Kit client.
 *
 * Sends push notifications to Huawei devices via HMS Push Kit v2.
 *
 * Env:
 *   HMS_APP_ID     — HMS App ID
 *   HMS_APP_SECRET — HMS App Secret (used to mint OAuth2 access token)
 *
 * Docs: https://developer.huawei.com/consumer/en/doc/HMSCore-Guides/android-payload-0000001050040454
 */

import { logger } from '@/lib/infra/logger';

const TOKEN_URL = 'https://oauth-login.cloud.huawei.com/oauth2/v3/token';
const PUSH_URL = (appId: string) => `https://push-api.cloud.hicloud.com/v2/${appId}/messages:send`;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(appId: string, appSecret: string): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: appId,
        client_secret: appSecret,
      }),
    });
    const data = await res.json() as any;
    if (!res.ok || !data.access_token) {
      logger.error('huawei.token_failed', { status: res.status, body: data });
      return null;
    }
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return data.access_token;
  } catch (e) {
    logger.error('huawei.token_network_error', { error: (e as Error).message });
    return null;
  }
}

export interface HuaweiMessage {
  notification?: { title: string; body: string; icon?: string; color?: string; sound?: string; tag?: string };
  android?: { collapseKey?: number; urgency?: 'HIGH' | 'NORMAL'; ttl?: string; category?: string };
  data?: string;
  token?: string[];
  topic?: string;
  condition?: string;
}

export interface HuaweiResult {
  ok: boolean;
  messageId?: string;
  requestId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export async function sendHuaweiMessage(msg: HuaweiMessage): Promise<HuaweiResult> {
  const appId = process.env.HMS_APP_ID;
  const appSecret = process.env.HMS_APP_SECRET;
  if (!appId || !appSecret) {
    return { ok: false, errorCode: 'not_configured', errorMessage: 'HMS_APP_ID and HMS_APP_SECRET required' };
  }
  const token = await getAccessToken(appId, appSecret);
  if (!token) {
    return { ok: false, errorCode: 'auth_failed', errorMessage: 'Failed to mint HMS OAuth2 token' };
  }

  try {
    const res = await fetch(PUSH_URL(appId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: msg }),
    });
    const data = await res.json() as any;
    if (res.status === 200 && data.code === '80000000') {
      return { ok: true, requestId: data.requestId, messageId: data.requestId };
    }
    return {
      ok: false,
      errorCode: String(data.code ?? 'huawei_error'),
      errorMessage: data.msg ?? data.message ?? `HTTP ${res.status}`,
    };
  } catch (e) {
    logger.error('huawei.network_error', { error: (e as Error).message });
    return { ok: false, errorCode: 'network_error', errorMessage: (e as Error).message };
  }
}

export function isHuaweiConfigured(): boolean {
  return !!(process.env.HMS_APP_ID && process.env.HMS_APP_SECRET);
}
