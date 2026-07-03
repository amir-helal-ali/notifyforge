/**
 * Notification worker — processes a queued notification through its channel engine.
 *
 * Flow:
 *   1. Mark notification as `processing`
 *   2. Resolve targets via engine
 *   3. Dispatch via engine
 *   4. Update notification status + provider message id
 *   5. On failure: schedule retry with exponential backoff (up to maxAttempts)
 *   6. If device was invalidated, mark token as invalid
 */

import { db } from '@/lib/db';
import { getChannelEngine } from '@/lib/channels/registry';
import { enqueue } from '@/lib/infra/queue';
import { logger } from '@/lib/infra/logger';
import type { Job } from '@/lib/infra/queue';

const BACKOFF_MS = [0, 5_000, 30_000, 120_000, 600_000]; // 0s, 5s, 30s, 2m, 10m

export async function processNotificationJob(job: Job): Promise<void> {
  const notification = await db.notification.findUnique({
    where: { id: job.notificationId },
  });
  if (!notification) {
    logger.warn('worker.notification_missing', { notificationId: job.notificationId });
    return;
  }
  if (notification.status === 'cancelled') {
    logger.info('worker.cancelled_skip', { notificationId: notification.id });
    return;
  }

  const engine = getChannelEngine(notification.channel as never);
  if (!engine) {
    await failNotification(notification.id, 'no_engine', `No engine for channel ${notification.channel}`);
    return;
  }

  // 1. Mark processing
  await db.notification.update({
    where: { id: notification.id },
    data: { status: 'processing', attemptCount: { increment: 1 } },
  });
  await db.notificationEvent.create({
    data: { notificationId: notification.id, type: 'processing' },
  });

  try {
    // 2. Resolve targets
    const providerTargets = await engine.resolveTargets(notification);
    if (providerTargets.length === 0) {
      await failNotification(notification.id, 'no_targets', 'No targets resolved for the notification.');
      return;
    }

    // 3. Dispatch
    const result = await engine.dispatch(notification, providerTargets);

    if (result.errorCode) {
      // Mark device invalid if the provider says so
      if (result.invalidateDevice) {
        await db.device.updateMany({
          where: { projectId: notification.projectId, channel: notification.channel as never },
          data: { tokenStatus: 'invalid', invalidatedAt: new Date() },
        });
      }

      // Retry if attempts remain
      const attempts = notification.attemptCount + 1;
      if (attempts < notification.maxAttempts) {
        const backoff = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] ?? 600_000;
        await db.notification.update({
          where: { id: notification.id },
          data: {
            status: 'queued',
            errorMessage: result.errorMessage,
            errorCode: result.errorCode,
          },
        });
        await db.notificationLog.create({
          data: {
            notificationId: notification.id,
            level: 'warn',
            stage: 'retry',
            message: `Attempt ${attempts} failed: ${result.errorCode} — retry in ${backoff}ms`,
          },
        });
        enqueue({
          notificationId: notification.id,
          channel: notification.channel as never,
          attempt: attempts + 1,
          scheduledFor: Date.now() + backoff,
        });
        return;
      }

      await failNotification(notification.id, result.errorCode, result.errorMessage ?? 'Dispatch failed');
      return;
    }

    // 4. Success
    await db.notification.update({
      where: { id: notification.id },
      data: {
        status: result.deliveredAt ? 'delivered' : 'sent',
        providerMessageId: result.providerMessageId,
        provider: engine.provider,
        sentAt: new Date(),
        deliveredAt: result.deliveredAt,
        errorMessage: null,
        errorCode: null,
      },
    });
    await db.notificationEvent.create({
      data: {
        notificationId: notification.id,
        type: result.deliveredAt ? 'delivered' : 'sent',
        meta: result.providerMessageId ? JSON.stringify({ providerMessageId: result.providerMessageId }) : null,
      },
    });
    logger.info('worker.delivered', {
      notificationId: notification.id,
      channel: notification.channel,
      provider: engine.provider,
    });
  } catch (e) {
    const attempts = notification.attemptCount + 1;
    if (attempts < notification.maxAttempts) {
      const backoff = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)] ?? 600_000;
      await db.notification.update({
        where: { id: notification.id },
        data: { status: 'queued', errorMessage: (e as Error).message },
      });
      enqueue({
        notificationId: notification.id,
        channel: notification.channel as never,
        attempt: attempts + 1,
        scheduledFor: Date.now() + backoff,
      });
    } else {
      await failNotification(notification.id, 'worker_exception', (e as Error).message);
    }
  }
}

async function failNotification(id: string, code: string, message: string): Promise<void> {
  await db.notification.update({
    where: { id },
    data: {
      status: 'failed',
      errorCode: code,
      errorMessage: message,
      failedAt: new Date(),
    },
  });
  await db.notificationEvent.create({
    data: { notificationId: id, type: 'failed', meta: JSON.stringify({ code, message }) },
  });
  await db.notificationLog.create({
    data: { notificationId: id, level: 'error', stage: 'finalize', message: `${code}: ${message}` },
  });
}
