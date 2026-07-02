import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';

/**
 * POST /api/v1/notifications/[id]/cancel — cancel a queued/scheduled notification.
 * Notifications already sent cannot be cancelled (use channel-specific recall if available).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { requiredScope: SCOPES.notificationsWrite, action: 'notification.cancel' });
  if (!g.ok) return g.response;
  const { ctx: authCtx } = g.data;
  const { id } = await ctx.params;

  const n = await db.notification.findFirst({ where: { id, orgId: authCtx.orgId } });
  if (!n) return apiError('not_found', 'Notification not found', 404);
  if (['sent', 'delivered', 'failed', 'cancelled'].includes(n.status)) {
    return apiError('invalid_state', `Cannot cancel notification in status ${n.status}`, 409);
  }

  await db.notification.update({
    where: { id },
    data: { status: 'cancelled' },
  });
  await db.notificationEvent.create({
    data: { notificationId: id, type: 'cancelled' },
  });

  return ok({ id, status: 'cancelled' });
}

export const dynamic = 'force-dynamic';
