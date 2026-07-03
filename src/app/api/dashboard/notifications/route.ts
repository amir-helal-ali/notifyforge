import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const url = new URL(req.url);
  const channel = url.searchParams.get('channel') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25', 10));

  const where = {
    orgId: ctx.orgId,
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
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
        createdAt: true, sentAt: true, deliveredAt: true, failedAt: true,
        project: { select: { id: true, name: true } },
        application: { select: { id: true, name: true } },
      },
    }),
    db.notification.count({ where }),
  ]);
  return ok({
    data: data.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      sentAt: n.sentAt?.toISOString() ?? null,
      deliveredAt: n.deliveredAt?.toISOString() ?? null,
      failedAt: n.failedAt?.toISOString() ?? null,
    })),
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  });
}

export const dynamic = 'force-dynamic';
