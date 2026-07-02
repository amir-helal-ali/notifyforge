import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok, parseJson, paginate, getPagination, notFound, conflict } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';

/**
 * POST /api/v1/projects — create a project under the caller's organization
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.projectsWrite, action: 'project.create' });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const body = await parseJson<{ name: string; slug?: string; description?: string }>(req);
  if (!body?.name) return apiError('validation_error', 'name required', 422);
  const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = await db.project.findUnique({ where: { orgId_slug: { orgId: ctx.orgId, slug } } });
  if (existing) return conflict('Project slug already exists in this organization');
  const project = await db.project.create({
    data: { orgId: ctx.orgId, name: body.name, slug, description: body.description },
  });
  return ok(project, 201);
}

/**
 * GET /api/v1/projects — list projects in the caller's organization
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.projectsRead });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const { page, pageSize } = getPagination(req);
  const [data, total] = await Promise.all([
    db.project.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { applications: true, devices: true, notifications: true } } },
    }),
    db.project.count({ where: { orgId: ctx.orgId } }),
  ]);
  return ok(paginate(data, page, pageSize, total));
}

export const dynamic = 'force-dynamic';
