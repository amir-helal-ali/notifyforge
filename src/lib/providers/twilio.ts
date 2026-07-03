/**
 * Twilio Messages API client.
 *
 * Sends SMS via Twilio's REST API.
 *
 * Env:
 *   TWILIO_ACCOUNT_SID — Twilio Account SID (AC...)
 *   TWILIO_AUTH_TOKEN  — Twilio Auth Token
 *   TWILIO_FROM        — Default From number (optional; per-message overrides)
 *
 * Docs: https://www.twilio.com/docs/sms/api/message-resource
 */

import { logger } from '@/lib/infra/logger';

export interface TwilioSms {
  from?: string;
  to: string;
  body: string;
  mediaUrls?: string[];
  validityPeriod?: number;
  statusCallback?: string;
}

export interface TwilioResult {
  ok: boolean;
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export async function sendTwilioSms(sms: TwilioSms): Promise<TwilioResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    return { ok: false, errorCode: 'not_configured', errorMessage: 'TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required' };
  }
  const from = sms.from ?? process.env.TWILIO_FROM;
  if (!from) {
    return { ok: false, errorCode: 'no_from', errorMessage: 'from or TWILIO_FROM required' };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({
    From: from,
    To: sms.to,
    Body: sms.body,
  });
  if (sms.mediaUrls?.length) params.append('MediaUrl', sms.mediaUrls[0]!);
  if (sms.validityPeriod) params.append('ValidityPeriod', String(sms.validityPeriod));
  if (sms.statusCallback) params.append('StatusCallback', sms.statusCallback);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    const data = await res.json() as any;
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, messageId: data.sid };
    }
    return {
      ok: false,
      errorCode: data.error_code ? String(data.error_code) : 'twilio_error',
      errorMessage: data.error_message ?? `HTTP ${res.status}`,
    };
  } catch (e) {
    logger.error('twilio.network_error', { error: (e as Error).message });
    return { ok: false, errorCode: 'network_error', errorMessage: (e as Error).message };
  }
}

export function isTwilioConfigured(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}
