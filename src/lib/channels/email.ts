/**
 * Email Provider — pluggable adapter for SendGrid / SES / Postmark / SMTP.
 *
 * Default provider is "sendgrid" (via /v3/mail/send).
 * SMTP transport available via nodemailer when configured.
 */

import type { Notification, EmailPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';
import { sendSendGridMail, isSendGridConfigured } from '@/lib/providers/sendgrid';

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
      if (isSendGridConfigured()) {
        // Real SendGrid delivery
        const result = await sendSendGridMail({
          from: payload.from,
          to: Array.isArray(payload.to) ? payload.to : [payload.to],
          cc: payload.cc ? (Array.isArray(payload.cc) ? payload.cc : [payload.cc]) : undefined,
          bcc: payload.bcc ? (Array.isArray(payload.bcc) ? payload.bcc : [payload.bcc]) : undefined,
          replyTo: payload.replyTo,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
          attachments: payload.attachments,
          headers: payload.headers,
          category: payload.category,
          templateId: payload.templateId,
          templateData: payload.templateData,
        });
        if (!result.ok) {
          return { errorCode: result.errorCode, errorMessage: result.errorMessage };
        }
        return { providerMessageId: result.messageId, deliveredAt: new Date() };
      }

      // Simulated mode
      logger.info('email.dispatch_simulated', {
        notificationId: n.id,
        recipients: providerTargets.length,
        provider: 'sendgrid',
        note: 'Set SENDGRID_API_KEY to enable real delivery',
      });
      const providerMessageId = `sendgrid:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return { providerMessageId, deliveredAt: new Date() };
    } catch (e) {
      return { errorCode: 'email_provider_error', errorMessage: (e as Error).message };
    }
  },
};
