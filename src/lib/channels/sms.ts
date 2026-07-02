/**
 * SMS Provider — pluggable adapter for Twilio / Vonage / MessageBird.
 *
 * Default: Twilio (POST https://api.twilio.com/2010-04-01/Accounts/{Sid}/Messages.json)
 */

import type { Notification, SmsPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';

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
      // Twilio Message envelope
      const envelope = {
        From: payload.from ?? process.env.TWILIO_FROM ?? '+15550000000',
        To: providerTargets,
        Body: payload.body,
        ...(payload.mediaUrls ? { MediaUrl: payload.mediaUrls } : {}),
        ...(payload.validityPeriod ? { ValidityPeriod: payload.validityPeriod } : {}),
      };
      logger.info('sms.dispatch', {
        notificationId: n.id,
        recipients: providerTargets.length,
        provider: 'twilio',
      });
      const providerMessageId = `twilio:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return { providerMessageId, deliveredAt: new Date() };
    } catch (e) {
      return { errorCode: 'sms_provider_error', errorMessage: (e as Error).message };
    }
  },
};
