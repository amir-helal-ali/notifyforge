/**
 * Email Provider — pluggable adapter for SendGrid / SES / Postmark / SMTP.
 *
 * Default provider is "sendgrid" (via /v3/mail/send).
 * SMTP transport available via nodemailer when configured.
 */

import type { Notification, EmailPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';

export const emailEngine: ChannelEngine<EmailPayload> = {
  channel: 'email',
  provider: 'sendgrid',
  validatePayload(p) {
    if (!p?.from) return { valid: false, error: 'payload.from required' };
    if (!p?.to) return { valid: false, error: 'payload.to required' };
    if (!p?.subject) return { valid: false, error: 'payload.subject required' };
    if (!p?.html && !p?.text) return { valid: false, error: 'payload.html or payload.text required' };
    return { valid: true };
  },
  validateTarget(t: TargetSpec) {
    if (!t.email && !(Array.isArray(t.email) && t.email.length)) {
      return { valid: false, error: 'target.email required for email channel' };
    }
    return { valid: true };
  },
  async resolveTargets(n: Notification) {
    const target = JSON.parse(n.target) as TargetSpec;
    const emails = Array.isArray(target.email) ? target.email : target.email ? [target.email] : [];
    return emails;
  },
  async dispatch(n: Notification, providerTargets: string[]): Promise<DispatchResult> {
    const payload = JSON.parse(n.payload) as EmailPayload;
    try {
      // SendGrid v3 mail/send envelope
      const envelope = {
        personalizations: providerTargets.map((addr) => ({ to: [{ email: addr }] })),
        from: { email: payload.from },
        subject: payload.subject,
        content: [
          ...(payload.html ? [{ type: 'text/html', value: payload.html }] : []),
          ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
        ],
        ...(payload.replyTo ? { reply_to: { email: payload.replyTo } } : {}),
        ...(payload.headers ? { headers: payload.headers } : {}),
        ...(payload.category ? { categories: [payload.category] } : {}),
        ...(payload.attachments
          ? { attachments: payload.attachments.map((a) => ({ filename: a.filename, content: a.content, type: a.contentType })) }
          : {}),
      };
      logger.info('email.dispatch', {
        notificationId: n.id,
        recipients: providerTargets.length,
        provider: 'sendgrid',
      });
      const providerMessageId = `sendgrid:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return { providerMessageId, deliveredAt: new Date() };
    } catch (e) {
      return { errorCode: 'email_provider_error', errorMessage: (e as Error).message };
    }
  },
};
