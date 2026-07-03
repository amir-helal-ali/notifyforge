/**
 * POST /api/v1/notifications/bulk-cancel
 * Body: { ids: string[] }
 * Cancels multiple queued/scheduled notifications at once.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok, parseJson } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';
import { writeAudit } from '@/lib/infra/audit';

export async function POST(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.notificationsWrite, action: 'notification.bulk_cancel' });
  if (!g.ok) return g.response;
  const { ctx: authCtx } = g.data;

  const body = await parseJson<{ ids: string[] }>(req);
  if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return apiError('validation_error', 'ids array required', 422);
  }
  if (body.ids.length > 1000) {
    return apiError('validation_error', 'Cannot cancel more than 1000 notifications at once', 422);
  }

  // Only cancel notifications that belong to the caller's org and are in a cancellable state
  const result = await db.notification.updateMany({
    where: {
      id: { in: body.ids },
      orgId: authCtx.orgId,
      status: { in: ['queued', 'processing'] },
    },
    data: { status: 'cancelled' },
  });

  // Emit events for each cancelled notification
  const cancelled = await db.notification.findMany({
    where: { id: { in: body.ids }, orgId: authCtx.orgId, status: 'cancelled' },
    select: { id: true },
  });
  await db.notificationEvent.createMany({
    data: cancelled.map((n) => ({ notificationId: n.id, type: 'cancelled' })),
    skipDuplicates: true,
  }).catch(() => undefined);

  await writeAudit({
    orgId: authCtx.orgId,
    projectId: authCtx.projectId,
    action: 'notification.bulk_cancel',
    meta: { requested: body.ids.length, cancelled: result.count },
  });

  return ok({
    requested: body.ids.length,
    cancelled: result.count,
    skipped: body.ids.length - result.count,
  });
}

export const dynamic = 'force-dynamic';
