/**
 * FCM Provider — Firebase Cloud Messaging for Android.
 *
 * In production this calls https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
 * with an OAuth2 access token minted from the service account JSON.
 *
 * For the runnable reference implementation we use the legacy HTTP v1 contract
 * and simulate the round-trip when no credentials are configured. The dispatch
 * interface is identical either way — only the transport layer changes.
 */

import { db } from '@/lib/db';
import type { Notification, PushAndroidPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';
import { sendFcmMessage, isFcmConfigured } from '@/lib/providers/fcm';

export const fcmEngine: ChannelEngine<PushAndroidPayload> = {
  channel: 'push_android',
  provider: 'fcm',
  validatePayload(p) {
    if (!p || typeof p !== 'object') return { valid: false, error: 'payload required' };
    if (!p.title || typeof p.title !== 'string') return { valid: false, error: 'payload.title required' };
    if (!p.body || typeof p.body !== 'string') return { valid: false, error: 'payload.body required' };
    return { valid: true };
  },
  validateTarget(t: TargetSpec) {
    if (!t.deviceId && !t.externalUserId && !t.topic && !(t.devices && t.devices.length) && !(t.externalUserIds && t.externalUserIds.length)) {
      return { valid: false, error: 'target requires one of: deviceId, externalUserId, topic, devices[], externalUserIds[]' };
    }
    return { valid: true };
  },
  async resolveTargets(n: Notification) {
    const target = JSON.parse(n.target) as TargetSpec;
    if (target.devices && target.devices.length) return target.devices;
    if (target.deviceId) return [target.deviceId];
    // resolve by externalUserId or topic
    const where = {
      projectId: n.projectId,
      channel: 'push_android' as const,
      tokenStatus: 'active' as const,
      ...(target.externalUserId ? { externalUserId: target.externalUserId } : {}),
    };
    const devices = await db.device.findMany({ where, select: { id: true } });
    return devices.map((d) => d.id);
  },
  async dispatch(n: Notification, providerTargets: string[]): Promise<DispatchResult> {
    const payload = JSON.parse(n.payload) as PushAndroidPayload;
    // Resolve tokens for the device IDs
    const devices = await db.device.findMany({
      where: { id: { in: providerTargets } },
      select: { id: true, token: true, tokenStatus: true },
    });
    const tokens = devices.filter((d) => d.tokenStatus === 'active').map((d) => d.token);

    if (tokens.length === 0) {
      return {
        errorCode: 'no_active_devices',
        errorMessage: 'No active device tokens for the requested targets.',
      };
    }

    try {
      // Build FCM v1 message envelope
      const message = {
        token: tokens.length === 1 ? tokens[0] : undefined,
        tokens: tokens.length > 1 ? tokens : undefined,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: {
          priority: payload.android?.priority ?? (n.priority === 'high' || n.priority === 'critical' ? 'high' : 'normal'),
          collapseKey: payload.android?.collapseKey ?? n.collapseKey,
          ttl: payload.android?.ttl ?? (n.ttlSeconds ? `${n.ttlSeconds}s` : undefined),
        },
        fcmOptions: payload.fcmOptions,
      };

      // If FCM is configured with real credentials, send a real push.
      // Otherwise, fall back to a simulated provider response.
      if (isFcmConfigured()) {
        const result = await sendFcmMessage(message);
        if (!result.ok) {
          return {
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
            invalidateDevice: result.errorCode === 'UNREGISTERED' || result.errorCode === 'invalid_registration',
          };
        }
        return {
          providerMessageId: result.messageId,
          deliveredAt: new Date(),
        };
      }

      // Simulated mode — no credentials configured
      logger.info('fcm.dispatch_simulated', {
        notificationId: n.id,
        tokens: tokens.length,
        provider: 'fcm',
        note: 'Set FCM_SERVICE_ACCOUNT_JSON to enable real delivery',
      });
      const providerMessageId = `fcm:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return {
        providerMessageId,
        deliveredAt: new Date(),
      };
    } catch (e) {
      return {
        errorCode: 'fcm_provider_error',
        errorMessage: (e as Error).message,
      };
    }
  },
};
