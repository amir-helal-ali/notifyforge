import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError } from '@/lib/infra/api';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const mctx = await readMasterKeyContext();
  if (!mctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const { id } = await ctx.params;
  const n = await db.notification.findFirst({
    where: { id, orgId: mctx.orgId },
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
