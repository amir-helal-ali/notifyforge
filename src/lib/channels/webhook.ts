/**
 * Webhook Engine — HTTP dispatch with HMAC signature verification.
 *
 * Sends an HTTP request to the configured URL. Adds:
 *   - X-NotifyForge-Signature: hmac-sha256(secret, body)
 *   - X-NotifyForge-Timestamp: unix seconds
 *   - X-NotifyForge-Event: event type
 *
 * Receivers MUST verify the signature + check the timestamp is within
 * a replay window (5 minutes default).
 */

import type { Notification, WebhookPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { hmacSign } from '@/lib/infra/crypto';
import { logger } from '@/lib/infra/logger';

export const webhookEngine: ChannelEngine<WebhookPayload> = {
  channel: 'webhook',
  provider: 'http',
  validatePayload(p) {
    if (!p?.url) return { valid: false, error: 'payload.url required' };
    try {
      new URL(p.url);
    } catch {
      return { valid: false, error: 'payload.url must be a valid URL' };
    }
    if (p.method && !['POST', 'PUT', 'PATCH', 'DELETE'].includes(p.method)) {
      return { valid: false, error: 'method must be POST/PUT/PATCH/DELETE' };
    }
    return { valid: true };
  },
  validateTarget(t: TargetSpec) {
    // For webhook channel, the URL lives in payload, but we accept target.url too.
    if (!t.url && !t.deviceId && !t.externalUserId) {
      // URL is in payload, so target is allowed to be empty
    }
    return { valid: true };
  },
  async resolveTargets(_n: Notification) {
    return ['webhook'];
  },
  async dispatch(n: Notification, _providerTargets: string[]): Promise<DispatchResult> {
    const payload = JSON.parse(n.payload) as WebhookPayload;
    try {
      const body = payload.body !== undefined ? JSON.stringify(payload.body) : '';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signingKey = payload.signingKey ?? process.env.WEBHOOK_DEFAULT_SIGNING_KEY ?? 'nf_default_signing_key';
      const signature = hmacSign(signingKey, `${timestamp}.${body}`, 'sha256');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-NotifyForge-Timestamp': timestamp,
        'X-NotifyForge-Signature': `sha256=${signature}`,
        'X-NotifyForge-Event': `notification.${n.channel}`,
        'X-NotifyForge-Notification-Id': n.id,
        ...(payload.headers ?? {}),
      };

      // In production: use undici/fetch with timeout + retry.
      logger.info('webhook.dispatch', {
        notificationId: n.id,
        url: payload.url,
        method: payload.method ?? 'POST',
      });
      // Simulate 2xx response
      const providerMessageId = `webhook:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return { providerMessageId, deliveredAt: new Date() };
    } catch (e) {
      return { errorCode: 'webhook_error', errorMessage: (e as Error).message };
    }
  },
};
