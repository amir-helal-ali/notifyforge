/**
 * Web Push Provider — VAPID + Web Push Protocol (RFC 8030).
 *
 * Production: encrypts payload with aes128gcm per RFC 8291 and POSTs to
 * the push endpoint with TTL, Urgency, Topic headers.
 *
 * Here we simulate the round-trip but persist the WebPush subscription.
 */

import { db } from '@/lib/db';
import type { Notification, WebPushPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';

export const webPushEngine: ChannelEngine<WebPushPayload> = {
  channel: 'webpush',
  provider: 'webpush',
  validatePayload(p) {
    if (!p?.title || !p?.body) return { valid: false, error: 'payload.title and payload.body required' };
    if (p.urgency && !['very-low', 'low', 'normal', 'high'].includes(p.urgency)) {
      return { valid: false, error: 'invalid urgency' };
    }
    return { valid: true };
  },
  validateTarget(t: TargetSpec) {
    if (!t.deviceId && !t.externalUserId && !(t.devices && t.devices.length)) {
      return { valid: false, error: 'target requires one of: deviceId, externalUserId, devices[]' };
    }
    return { valid: true };
  },
  async resolveTargets(n: Notification) {
    const target = JSON.parse(n.target) as TargetSpec;
    if (target.devices && target.devices.length) return target.devices;
    if (target.deviceId) return [target.deviceId];
    const devices = await db.device.findMany({
      where: {
        projectId: n.projectId,
        channel: 'webpush',
        tokenStatus: 'active',
        ...(target.externalUserId ? { externalUserId: target.externalUserId } : {}),
      },
      select: { id: true },
    });
    return devices.map((d) => d.id);
  },
  async dispatch(n: Notification, providerTargets: string[]): Promise<DispatchResult> {
    const payload = JSON.parse(n.payload) as WebPushPayload;
    const devices = await db.device.findMany({
      where: { id: { in: providerTargets } },
      select: { token: true, tokenStatus: true },
    });
    const endpoints = devices.filter((d) => d.tokenStatus === 'active').map((d) => d.token);

    if (endpoints.length === 0) {
      return { errorCode: 'no_active_subscriptions', errorMessage: 'No active web push subscriptions.' };
    }

    try {
      const message = {
        payload: JSON.stringify(payload),
        ttl: n.ttlSeconds ?? 2419200,
        urgency: payload.urgency ?? 'normal',
        topic: payload.tag,
      };
      logger.info('webpush.dispatch', {
        notificationId: n.id,
        endpoints: endpoints.length,
        urgency: message.urgency,
      });
      const providerMessageId = `webpush:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return { providerMessageId, deliveredAt: new Date() };
    } catch (e) {
      return { errorCode: 'webpush_provider_error', errorMessage: (e as Error).message };
    }
  },
};
