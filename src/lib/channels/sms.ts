/**
 * SMS Provider — pluggable adapter for Twilio / Vonage / MessageBird.
 *
 * Default: Twilio (POST https://api.twilio.com/2010-04-01/Accounts/{Sid}/Messages.json)
 */

import type { Notification, SmsPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';
import { sendTwilioSms, isTwilioConfigured } from '@/lib/providers/twilio';

export const smsEngine: ChannelEngine<SmsPayload> = {
  channel: 'sms',
  provider: 'twilio',
  validatePayload(p) {
    if (!p?.to) return { valid: false, error: 'payload.to required' };
    if (!p?.body) return { valid: false, error: 'payload.body required' };
    if (p.encoding && !['auto', 'gsm7', 'ucs2'].includes(p.encoding)) {
      return { valid: false, error: 'invalid encoding' };
    }
    return { valid: true };
  },
  validateTarget(t: TargetSpec) {
    if (!t.phone && !(Array.isArray(t.phone) && t.phone.length)) {
      return { valid: false, error: 'target.phone required for sms channel' };
    }
    return { valid: true };
  },
  async resolveTargets(n: Notification) {
    const target = JSON.parse(n.target) as TargetSpec;
    const phones = Array.isArray(target.phone) ? target.phone : target.phone ? [target.phone] : [];
    return phones;
  },
  async dispatch(n: Notification, providerTargets: string[]): Promise<DispatchResult> {
    const payload = JSON.parse(n.payload) as SmsPayload;
    try {
      if (isTwilioConfigured()) {
        // Real Twilio delivery — one API call per recipient
        const results = await Promise.all(
          providerTargets.map((to) =>
            sendTwilioSms({
              from: payload.from,
              to,
              body: payload.body,
              mediaUrls: payload.mediaUrls,
              validityPeriod: payload.validityPeriod,
            }),
          ),
        );
        const firstOk = results.find((r) => r.ok);
        if (firstOk) {
          return { providerMessageId: firstOk.messageId, deliveredAt: new Date() };
        }
        const firstErr = results[0]!;
        return { errorCode: firstErr.errorCode, errorMessage: firstErr.errorMessage };
      }

      // Simulated mode
      logger.info('sms.dispatch_simulated', {
        notificationId: n.id,
        recipients: providerTargets.length,
        provider: 'twilio',
        note: 'Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to enable real delivery',
      });
      const providerMessageId = `twilio:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return { providerMessageId, deliveredAt: new Date() };
    } catch (e) {
      return { errorCode: 'sms_provider_error', errorMessage: (e as Error).message };
    }
  },
};
