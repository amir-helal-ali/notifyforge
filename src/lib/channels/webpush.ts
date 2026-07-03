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
import { sendWebPushMessage, isWebPushConfigured, type WebPushSubscription } from '@/lib/providers/webpush';

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
      if (isWebPushConfigured()) {
        // Real Web Push delivery — POST aes128gcm-encrypted payload to each endpoint
        // The Device.token field stores the full subscription JSON for webpush
        const devices = await db.device.findMany({
          where: { id: { in: providerTargets } },
          select: { token: true, tokenStatus: true },
        });
        let delivered = 0;
        let lastError: { code: string; message: string } | null = null;
        for (const d of devices) {
          if (d.tokenStatus !== 'active') continue;
          // Token format: '<endpoint>|<p256dh>|<auth>' or full JSON subscription
          let subscription: WebPushSubscription;
          try {
            const parsed = JSON.parse(d.token);
            subscription = {
              endpoint: parsed.endpoint,
              keys: { p256dh: parsed.keys.p256dh, auth: parsed.keys.auth },
            };
          } catch {
            const parts = d.token.split('|');
            if (parts.length !== 3) continue;
            subscription = { endpoint: parts[0]!, keys: { p256dh: parts[1]!, auth: parts[2]! } };
          }
          const result = await sendWebPushMessage(subscription, {
            title: payload.title,
            body: payload.body,
            icon: payload.icon,
            badge: payload.badge,
            image: payload.image,
            data: payload.data,
            actions: payload.actions,
            tag: payload.tag,
            requireInteraction: payload.requireInteraction,
            urgency: payload.urgency,
            ttl: n.ttlSeconds ?? undefined,
          });
          if (result.ok) delivered++;
          else lastError = { code: result.errorCode ?? 'webpush_error', message: result.errorMessage ?? 'unknown' };
        }
        if (delivered > 0) {
          return { providerMessageId: `webpush:${n.id}`, deliveredAt: new Date() };
        }
        return {
          errorCode: lastError?.code ?? 'no_active_subscriptions',
          errorMessage: lastError?.message ?? 'No active web push subscriptions.',
        };
      }

      // Simulated mode
      logger.info('webpush.dispatch_simulated', {
        notificationId: n.id,
        endpoints: endpoints.length,
        urgency: payload.urgency ?? 'normal',
        note: 'Set WEBPUSH_VAPID_PUBLIC_KEY and WEBPUSH_VAPID_PRIVATE_KEY to enable real delivery',
      });
      const providerMessageId = `webpush:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return { providerMessageId, deliveredAt: new Date() };
    } catch (e) {
      return { errorCode: 'webpush_provider_error', errorMessage: (e as Error).message };
    }
  },
};
