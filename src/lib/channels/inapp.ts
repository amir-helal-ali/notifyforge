/**
 * In-App Notification Engine — persists to the notification store.
 *
 * Unlike push channels, in-app notifications are read by the client SDK
 * via GET /api/v1/inapp/messages?userId={externalUserId}. They are never
 * "pushed" — the platform only stores them.
 */

import { db } from '@/lib/db';
import type { Notification, InAppPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';

export const inAppEngine: ChannelEngine<InAppPayload> = {
  channel: 'inapp',
  provider: 'inapp',
  validatePayload(p) {
    if (!p?.userId) return { valid: false, error: 'payload.userId required' };
    if (!p?.title || !p?.body) return { valid: false, error: 'payload.title and payload.body required' };
    return { valid: true };
  },
  validateTarget(t: TargetSpec) {
    if (!t.externalUserId) return { valid: false, error: 'target.externalUserId required for inapp channel' };
    return { valid: true };
  },
  async resolveTargets(n: Notification) {
    const target = JSON.parse(n.target) as TargetSpec;
    return target.externalUserId ? [target.externalUserId] : [];
  },
  async dispatch(n: Notification, providerTargets: string[]): Promise<DispatchResult> {
    const payload = JSON.parse(n.payload) as InAppPayload;
    try {
      // In-app is "delivered" the moment it's persisted.
      // Push to the real-time WebSocket service so connected clients receive it instantly.
      try {
        const target = JSON.parse(n.target) as { externalUserId?: string };
        if (target.externalUserId) {
          await fetch('http://localhost:3004/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: n.projectId,
              externalUserId: target.externalUserId,
              notification: {
                id: n.id,
                title: payload.title,
                body: payload.body,
                category: payload.category,
                priority: payload.priority ?? n.priority,
                actionUrl: payload.actionUrl,
                imageUrl: payload.imageUrl,
                data: payload.data,
                createdAt: new Date().toISOString(),
              },
            }),
          });
        }
      } catch (e) {
        // Real-time push is best-effort — don't fail the dispatch if the WS service is down.
        logger.warn('inapp.broadcast_failed', { notificationId: n.id, error: (e as Error).message });
      }
      logger.info('inapp.dispatch', {
        notificationId: n.id,
        userId: payload.userId,
      });
      return {
        providerMessageId: `inapp:${n.id}`,
        deliveredAt: new Date(),
      };
    } catch (e) {
      return { errorCode: 'inapp_error', errorMessage: (e as Error).message };
    }
  },
};
