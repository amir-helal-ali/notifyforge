import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok, parseJson, getPagination, paginate, notFound } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';

export async function POST(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.appsWrite, action: 'app.create' });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const body = await parseJson<{ projectId: string; name: string; slug?: string; platform: string; description?: string; metadata?: Record<string, unknown> }>(req);
  if (!body?.projectId || !body?.name || !body?.platform) return apiError('validation_error', 'projectId, name, platform required', 422);

  // Verify project belongs to caller's org
  const project = await db.project.findFirst({ where: { id: body.projectId, orgId: ctx.orgId } });
  if (!project) return notFound('Project not found');

  const allowedPlatforms = ['mobile_android', 'mobile_ios', 'mobile_huawei', 'web', 'desktop', 'backend'];
  if (!allowedPlatforms.includes(body.platform)) {
    return apiError('validation_error', `platform must be one of: ${allowedPlatforms.join(', ')}`, 422);
  }

  const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = await db.application.findUnique({ where: { projectId_slug: { projectId: body.projectId, slug } } });
  if (existing) return apiError('conflict', 'Application slug already exists in project', 409);

  const app = await db.application.create({
    data: {
      projectId: body.projectId,
      name: body.name,
      slug,
      platform: body.platform,
      description: body.description,
      metadata: body.metadata ? JSON.stringify(body.metadata) : null,
    },
  });
  return ok(app, 201);
}

export async function GET(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.appsRead });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const { page, pageSize } = getPagination(req);

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
      include: { _count: { select: { devices: true, notifications: true } } },
    }),
    db.application.count({ where }),
  ]);
  return ok(paginate(data, page, pageSize, total));
}

export const dynamic = 'force-dynamic';
