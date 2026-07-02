import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError, parseJson } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25', 10));
  const where = {
    project: { orgId: ctx.orgId },
    ...(projectId ? { projectId } : {}),
  };
  const [data, total] = await Promise.all([
    db.application.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { project: { select: { id: true, name: true } }, _count: { select: { devices: true, notifications: true } } },
    }),
    db.application.count({ where }),
  ]);
  return ok({
    data: data.map((a) => ({
      ...a,
      metadata: a.metadata ? JSON.parse(a.metadata) : null,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const body = await parseJson<{ projectId: string; name: string; slug?: string; platform: string; description?: string }>(req);
  if (!body?.projectId || !body?.name || !body?.platform) return apiError('validation_error', 'projectId, name, platform required', 422);
  const project = await db.project.findFirst({ where: { id: body.projectId, orgId: ctx.orgId } });
  if (!project) return apiError('not_found', 'Project not found', 404);
  const allowed = ['mobile_android', 'mobile_ios', 'mobile_huawei', 'web', 'desktop', 'backend'];
  if (!allowed.includes(body.platform)) return apiError('validation_error', 'invalid platform', 422);
  const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = await db.application.findUnique({ where: { projectId_slug: { projectId: body.projectId, slug } } });
  if (existing) return apiError('conflict', 'App slug already exists', 409);
  const app = await db.application.create({
    data: { projectId: body.projectId, name: body.name, slug, platform: body.platform, description: body.description },
  });
  return ok({ ...app, createdAt: app.createdAt.toISOString() }, 201);
}

export const dynamic = 'force-dynamic';
