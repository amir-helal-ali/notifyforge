import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError, parseJson } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const url = new URL(req.url);
  const channel = url.searchParams.get('channel') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const externalUserId = url.searchParams.get('externalUserId') ?? undefined;
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25', 10));
  const where = {
    project: { orgId: ctx.orgId },
    ...(channel ? { channel } : {}),
    ...(status ? { tokenStatus: status } : {}),
    ...(externalUserId ? { externalUserId } : {}),
  };
  const [data, total] = await Promise.all([
    db.device.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, channel: true, token: true, tokenStatus: true, externalUserId: true,
        platform: true, appVersion: true, language: true, tags: true,
        lastSeenAt: true, invalidatedAt: true, createdAt: true,
        project: { select: { id: true, name: true } },
        application: { select: { id: true, name: true } },
      },
    }),
    db.device.count({ where }),
  ]);
  return ok({
    data: data.map((d) => ({
      ...d,
      token: d.token.slice(0, 8) + '…', // never expose full token in UI
      tags: d.tags ? JSON.parse(d.tags) : [],
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      invalidatedAt: d.invalidatedAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  });
}

export const dynamic = 'force-dynamic';
