/**
 * Desktop Notification Engine — emits platform-native notifications.
 *
 * On the client side, the NotifyForge Desktop SDK subscribes to a long-poll
 * or WebSocket channel and renders native notifications via Electron's
 * Notification API or the OS notification daemon.
 *
 * The server only stores the notification; the SDK polls it.
 */

import { db } from '@/lib/db';
import type { Notification, DesktopPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';

export const desktopEngine: ChannelEngine<DesktopPayload> = {
  channel: 'desktop',
  provider: 'desktop',
  validatePayload(p) {
    if (!p?.title || !p?.body) return { valid: false, error: 'payload.title and payload.body required' };
    if (p.urgency && !['low', 'normal', 'critical'].includes(p.urgency)) {
      return { valid: false, error: 'urgency must be low|normal|critical' };
    }
    return { valid: true };
  },
  validateTarget(t: TargetSpec) {
    if (!t.deviceId && !t.externalUserId) {
      return { valid: false, error: 'target.deviceId or target.externalUserId required' };
    }
    return { valid: true };
  },
  async resolveTargets(n: Notification) {
    const target = JSON.parse(n.target) as TargetSpec;
    if (target.deviceId) return [target.deviceId];
    const devices = await db.device.findMany({
      where: {
        projectId: n.projectId,
        channel: 'desktop',
        tokenStatus: 'active',
        ...(target.externalUserId ? { externalUserId: target.externalUserId } : {}),
      },
      select: { id: true },
    });
    return devices.map((d) => d.id);
  },
  async dispatch(n: Notification, _providerTargets: string[]): Promise<DispatchResult> {
    try {
      logger.info('desktop.dispatch', { notificationId: n.id });
      return {
        providerMessageId: `desktop:${n.id}`,
        deliveredAt: new Date(),
      };
    } catch (e) {
      return { errorCode: 'desktop_error', errorMessage: (e as Error).message };
    }
  },
};
