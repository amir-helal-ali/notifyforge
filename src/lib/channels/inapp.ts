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
      // The user's client polls /api/v1/inapp/messages to fetch.
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
