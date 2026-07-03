/**
 * APNs Provider — Apple Push Notification service via HTTP/2.
 *
 * Production: uses the `apns` npm package or native http2 with JWT
 * (ES256 signed with the .p8 key from the Apple Developer portal).
 *
 * Supports all APNs features per the platform spec:
 *   - HTTP/2 Provider API
 *   - JWT Authentication (provider token caching)
 *   - Sandbox (api.sandbox.push.apple.com) vs Production (api.push.apple.com)
 *   - Silent Push (content-available: 1)
 *   - Mutable Content (mutable-content: 1 — for Notification Service Extensions)
 *   - Live Activities (apns-push-type: liveactivity)
 *   - Critical Alerts (interruption-level: critical, with sound.critical)
 *   - Badge / Sound / Categories
 */

import { db } from '@/lib/db';
import type { Notification, PushIosPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';
import { sendApnsMessage, isApnsConfigured } from '@/lib/providers/apns';

export const apnsEngine: ChannelEngine<PushIosPayload> = {
  channel: 'push_ios',
  provider: 'apns',
  validatePayload(p) {
    if (!p || typeof p !== 'object') return { valid: false, error: 'payload required' };
    if (!p.alert?.title) return { valid: false, error: 'payload.alert.title required' };
    if (!p.alert?.body) return { valid: false, error: 'payload.alert.body required' };
    if (p['interruption-level'] && !['passive', 'active', 'time-sensitive', 'critical'].includes(p['interruption-level'])) {
      return { valid: false, error: 'invalid interruption-level' };
    }
    if (p['apns-priority'] && ![5, 10].includes(p['apns-priority'])) {
      return { valid: false, error: 'apns-priority must be 5 or 10' };
    }
    return { valid: true };
  },
  validateTarget(t: TargetSpec) {
    if (!t.deviceId && !t.externalUserId && !t.topic && !(t.devices && t.devices.length)) {
      return { valid: false, error: 'target requires one of: deviceId, externalUserId, topic, devices[]' };
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
        channel: 'push_ios',
        tokenStatus: 'active',
        ...(target.externalUserId ? { externalUserId: target.externalUserId } : {}),
      },
      select: { id: true },
    });
    return devices.map((d) => d.id);
  },
  async dispatch(n: Notification, providerTargets: string[]): Promise<DispatchResult> {
    const payload = JSON.parse(n.payload) as PushIosPayload;
    const devices = await db.device.findMany({
      where: { id: { in: providerTargets } },
      select: { id: true, token: true, tokenStatus: true },
    });
    const tokens = devices.filter((d) => d.tokenStatus === 'active').map((d) => d.token);

    if (tokens.length === 0) {
      return { errorCode: 'no_active_devices', errorMessage: 'No active iOS tokens.' };
    }

    try {
      // Build APNs request envelope
      const pushType = payload['apns-push-type'] ?? (payload['content-available'] === 1 ? 'background' : 'alert');
      const priority = payload['apns-priority'] ?? (pushType === 'background' ? 5 : 10);
      const aps: Record<string, unknown> = {
        alert: payload.alert,
      };
      if (payload.badge !== undefined) aps['badge'] = payload.badge;
      if (payload.sound !== undefined) aps['sound'] = payload.sound;
      if (payload.category) aps['category'] = payload.category;
      if (payload['thread-id']) aps['thread-id'] = payload['thread-id'];
      if (payload['content-available']) aps['content-available'] = payload['content-available'];
      if (payload['mutable-content']) aps['mutable-content'] = payload['mutable-content'];
      if (payload['interruption-level']) aps['interruption-level'] = payload['interruption-level'];
      if (payload['relevance-score'] !== undefined) aps['relevance-score'] = payload['relevance-score'];

      const body = {
        aps,
        ...(payload.data ?? {}),
      };

      // In production: stream http2 to api.push.apple.com/3/device/{token}
      // with JWT bearer (ES256). Each token = one request (APNs is unicast).
      if (isApnsConfigured()) {
        // Real APNs delivery
        const results = await Promise.all(
          tokens.map((token) =>
            sendApnsMessage({
              token,
              aps,
              pushType: payload['apns-push-type'],
              priority: payload['apns-priority'],
              topic: payload['apns-topic'],
              collapseId: payload['apns-collapse-id'],
            }),
          ),
        );
        const firstOk = results.find((r) => r.ok);
        if (firstOk) {
          return { providerMessageId: firstOk.messageId, deliveredAt: new Date() };
        }
        const firstErr = results[0]!;
        return {
          errorCode: firstErr.errorCode,
          errorMessage: firstErr.errorMessage,
          invalidateDevice: firstErr.errorCode === 'Unregistered' || firstErr.errorCode === 'BadDeviceToken',
        };
      }

      // Simulated mode
      logger.info('apns.dispatch_simulated', {
        notificationId: n.id,
        tokens: tokens.length,
        pushType,
        priority,
        note: 'Set APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY to enable real delivery',
      });
      const providerMessageId = `apns:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return { providerMessageId, deliveredAt: new Date() };
    } catch (e) {
      return { errorCode: 'apns_provider_error', errorMessage: (e as Error).message };
    }
  },
};
