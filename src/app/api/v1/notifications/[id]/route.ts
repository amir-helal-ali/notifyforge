import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';

/**
 * GET /api/v1/notifications/[id] — fetch a single notification with logs & events
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard(req, { requiredScope: SCOPES.notificationsRead });
  if (!g.ok) return g.response;
  const { ctx: authCtx } = g.data;
  const { id } = await ctx.params;
  const n = await db.notification.findFirst({
    where: { id, orgId: authCtx.orgId },
    include: {
      logs: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' } },
      project: { select: { id: true, name: true } },
      application: { select: { id: true, name: true } },
    },
  });
  if (!n) return apiError('not_found', 'Notification not found', 404);

  return ok({
    ...n,
    payload: JSON.parse(n.payload),
    target: JSON.parse(n.target),
    tags: n.tags ? JSON.parse(n.tags) : null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    sentAt: n.sentAt?.toISOString() ?? null,
    deliveredAt: n.deliveredAt?.toISOString() ?? null,
    failedAt: n.failedAt?.toISOString() ?? null,
    scheduledAt: n.scheduledAt?.toISOString() ?? null,
    logs: n.logs.map((l) => ({ ...l, meta: l.meta ? JSON.parse(l.meta) : null, createdAt: l.createdAt.toISOString() })),
    events: n.events.map((e) => ({ ...e, meta: e.meta ? JSON.parse(e.meta) : null, createdAt: e.createdAt.toISOString() })),
  });
}

export const dynamic = 'force-dynamic';
