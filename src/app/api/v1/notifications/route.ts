import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok, getPagination, paginate } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';

/**
 * GET /api/v1/notifications?channel=&status=&projectId=&page=&pageSize=
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.notificationsRead });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const channel = url.searchParams.get('channel');
  const status = url.searchParams.get('status');
  const externalId = url.searchParams.get('externalId');
  const { page, pageSize } = getPagination(req);

  const where = {
    orgId: ctx.orgId,
    ...(projectId ? { projectId } : {}),
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(externalId ? { externalId } : {}),
  };
  const [data, total] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, channel: true, status: true, priority: true, externalId: true,
        provider: true, providerMessageId: true, attemptCount: true, maxAttempts: true,
        errorCode: true, errorMessage: true,
        createdAt: true, sentAt: true, deliveredAt: true, failedAt: true, scheduledAt: true,
        project: { select: { id: true, name: true } },
      },
    }),
    db.notification.count({ where }),
  ]);
  return ok(paginate(
    data.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      sentAt: n.sentAt?.toISOString() ?? null,
      deliveredAt: n.deliveredAt?.toISOString() ?? null,
      failedAt: n.failedAt?.toISOString() ?? null,
      scheduledAt: n.scheduledAt?.toISOString() ?? null,
    })),
    page, pageSize, total,
  ));
}

export const dynamic = 'force-dynamic';
