/**
 * Huawei Push (HMS Push Kit) Provider.
 *
 * Production: POST https://push-api.cloud.hicloud.com/v2/{appId}/messages:send
 * with OAuth2 access token from https://oauth-login.cloud.huawei.com/oauth2/v3/token
 * using the App ID + App Secret from the HMS Console.
 */

import { db } from '@/lib/db';
import type { Notification, PushHuaweiPayload, TargetSpec } from '@/lib/types';
import type { ChannelEngine, DispatchResult } from '@/lib/channels/registry';
import { logger } from '@/lib/infra/logger';
import { sendHuaweiMessage, isHuaweiConfigured } from '@/lib/providers/huawei';

export const huaweiEngine: ChannelEngine<PushHuaweiPayload> = {
  channel: 'push_huawei',
  provider: 'huawei',
  validatePayload(p) {
    if (!p?.message?.notification?.title && !p?.message?.data) {
      return { valid: false, error: 'message.notification.title or message.data required' };
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
        channel: 'push_huawei',
        tokenStatus: 'active',
        ...(target.externalUserId ? { externalUserId: target.externalUserId } : {}),
      },
      select: { id: true },
    });
    return devices.map((d) => d.id);
  },
  async dispatch(n: Notification, providerTargets: string[]): Promise<DispatchResult> {
    const payload = JSON.parse(n.payload) as PushHuaweiPayload;
    const devices = await db.device.findMany({
      where: { id: { in: providerTargets } },
      select: { token: true, tokenStatus: true },
    });
    const tokens = devices.filter((d) => d.tokenStatus === 'active').map((d) => d.token);

    if (tokens.length === 0) {
      return { errorCode: 'no_active_devices', errorMessage: 'No active Huawei tokens.' };
    }

    try {
      if (isHuaweiConfigured()) {
        // Real HMS Push Kit delivery
        const result = await sendHuaweiMessage({
          ...payload.message,
          token: payload.message.token ?? tokens,
        });
        if (!result.ok) {
          return { errorCode: result.errorCode, errorMessage: result.errorMessage };
        }
        return {
          providerMessageId: result.messageId,
          deliveredAt: new Date(),
        };
      }

      // Simulated mode
      logger.info('huawei.dispatch_simulated', {
        notificationId: n.id,
        tokens: tokens.length,
        note: 'Set HMS_APP_ID and HMS_APP_SECRET to enable real delivery',
      });
      const providerMessageId = `huawei:${Buffer.from(n.id).toString('base64url').slice(0, 16)}`;
      return { providerMessageId, deliveredAt: new Date() };
    } catch (e) {
      return { errorCode: 'huawei_provider_error', errorMessage: (e as Error).message };
    }
  },
};
