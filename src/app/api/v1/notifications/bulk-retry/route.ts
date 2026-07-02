/**
 * POST /api/v1/notifications/bulk-retry
 * Body: { ids: string[] }
 * Re-queues failed notifications for another dispatch attempt.
 * Does NOT reset attemptCount — callers should check maxAttempts.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok, parseJson } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';
import { writeAudit } from '@/lib/infra/audit';
import { enqueue } from '@/lib/infra/queue';
import { logger } from '@/lib/infra/logger';

export async function POST(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.notificationsWrite, action: 'notification.bulk_retry' });
  if (!g.ok) return g.response;
  const { ctx: authCtx } = g.data;

  const body = await parseJson<{ ids: string[] }>(req);
  if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return apiError('validation_error', 'ids array required', 422);
  }
  if (body.ids.length > 1000) {
    return apiError('validation_error', 'Cannot retry more than 1000 notifications at once', 422);
  }

  const failed = await db.notification.findMany({
    where: {
      id: { in: body.ids },
      orgId: authCtx.orgId,
      status: 'failed',
    },
    select: { id: true, channel: true, attemptCount: true, maxAttempts: true },
  });

  let retried = 0;
  for (const n of failed) {
    // Reset status to queued and enqueue
    await db.notification.update({
      where: { id: n.id },
      data: {
        status: 'queued',
        errorCode: null,
        errorMessage: null,
        failedAt: null,
      },
    });
    await db.notificationEvent.create({
      data: { notificationId: n.id, type: 'queued', meta: JSON.stringify({ reason: 'manual_retry' }) },
    }).catch(() => undefined);
    enqueue({
      notificationId: n.id,
      channel: n.channel as never,
      attempt: n.attemptCount + 1,
      scheduledFor: Date.now(),
    });
    retried++;
  }

  await writeAudit({
    orgId: authCtx.orgId,
    projectId: authCtx.projectId,
    action: 'notification.bulk_retry',
    meta: { requested: body.ids.length, retried },
  });

  logger.info('bulk_retry.done', { requested: body.ids.length, retried });

  return ok({
    requested: body.ids.length,
    retried,
    skipped: body.ids.length - retried,
  });
}

export const dynamic = 'force-dynamic';
