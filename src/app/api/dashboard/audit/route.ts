import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25', 10));
  const where = {
    orgId: ctx.orgId,
    ...(projectId ? { projectId } : {}),
    ...(action ? { action } : {}),
  };
  const [data, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true } },
        project: { select: { id: true, name: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);
  return ok({
    data: data.map((a) => ({
      ...a,
      meta: a.meta ? JSON.parse(a.meta) : null,
      createdAt: a.createdAt.toISOString(),
    })),
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  });
}

export const dynamic = 'force-dynamic';
