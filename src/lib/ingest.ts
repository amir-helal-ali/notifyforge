/**
 * Notification ingest service — shared by every /api/v1/{channel}/send endpoint.
 *
 * Validates, deduplicates (via externalId), persists, and enqueues for dispatch.
 * No business logic beyond the channel the client explicitly chose.
 */

import { db } from '@/lib/db';
import { enqueue } from '@/lib/infra/queue';
import { getChannelEngine } from '@/lib/channels/registry';
import { writeAudit } from '@/lib/infra/audit';
import { logger } from '@/lib/infra/logger';
import type { AuthContext, Channel, SendRequest, SendResponse, TargetSpec } from '@/lib/types';

export async function ingestNotification<T extends Channel>(
  ctx: AuthContext,
  req: SendRequest<T>,
): Promise<{ response: SendResponse; error?: never; status?: number } | { error: { code: string; message: string; status: number } }> {
  const engine = getChannelEngine(req.channel);
  if (!engine) {
    return { error: { code: 'invalid_channel', message: `Channel ${req.channel} not supported`, status: 400 } };
  }

  // Validate target & payload
  const targetOk = engine.validateTarget(req.target);
  if (!targetOk.valid) {
    return { error: { code: 'validation_error', message: targetOk.error!, status: 422 } };
  }
  const payloadOk = engine.validatePayload(req.payload);
  if (!payloadOk.valid) {
    return { error: { code: 'validation_error', message: payloadOk.error!, status: 422 } };
  }

  if (!ctx.projectId) {
    return { error: { code: 'no_project', message: 'API key is not bound to a project', status: 400 } };
  }

  // Idempotency: if externalId is provided, check for an existing notification
  if (req.externalId) {
    const existing = await db.notification.findFirst({
      where: { projectId: ctx.projectId, externalId: req.externalId },
    });
    if (existing) {
      return {
        response: {
          id: existing.id,
          channel: existing.channel as Channel,
          status: existing.status as SendResponse['status'],
          externalId: existing.externalId ?? undefined,
          queuedAt: existing.createdAt.toISOString(),
        },
      };
    }
  }

  // Persist
  const notification = await db.notification.create({
    data: {
      orgId: ctx.orgId,
      projectId: ctx.projectId,
      applicationId: ctx.applicationId,
      apiKeyId: ctx.apiKeyId,
      channel: req.channel,
      externalId: req.externalId,
      status: 'queued',
      priority: req.priority ?? 'normal',
      payload: JSON.stringify(req.payload),
      target: JSON.stringify(req.target as TargetSpec),
      ttlSeconds: req.ttlSeconds ?? null,
      collapseKey: req.collapseKey ?? null,
      tags: req.tags ? JSON.stringify(req.tags) : null,
      scheduledAt: req.scheduledAt ? new Date(req.scheduledAt) : null,
      maxAttempts: 3,
    },
  });

  await db.notificationLog.create({
    data: {
      notificationId: notification.id,
      level: 'info',
      stage: 'ingest',
      message: `Accepted via ${req.channel} channel`,
    },
  });
  await db.notificationEvent.create({
    data: { notificationId: notification.id, type: 'created' },
  });

  // Enqueue for dispatch
  const scheduledFor = req.scheduledAt ? new Date(req.scheduledAt).getTime() : Date.now();
  enqueue({
    notificationId: notification.id,
    channel: req.channel,
    attempt: 1,
    scheduledFor,
  });

  await writeAudit({
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    action: `notification.send.${req.channel}`,
    resource: notification.id,
    meta: { channel: req.channel, priority: req.priority ?? 'normal' },
  });

  logger.info('ingest.accepted', {
    notificationId: notification.id,
    channel: req.channel,
    orgId: ctx.orgId,
    projectId: ctx.projectId,
  });

  return {
    response: {
      id: notification.id,
      channel: req.channel,
      status: 'queued',
      externalId: req.externalId,
      queuedAt: notification.createdAt.toISOString(),
    },
  };
}
