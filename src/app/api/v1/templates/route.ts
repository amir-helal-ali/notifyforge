import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok, parseJson, getPagination, paginate } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';

export async function POST(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.templatesWrite, action: 'template.create' });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const body = await parseJson<{ projectId: string; channel: string; name: string; slug?: string; subject?: string; body: string; variables?: Record<string, unknown>; locale?: string; description?: string }>(req);
  if (!body?.projectId || !body?.channel || !body?.name || !body?.body) {
    return apiError('validation_error', 'projectId, channel, name, body required', 422);
  }
  const project = await db.project.findFirst({ where: { id: body.projectId, orgId: ctx.orgId } });
  if (!project) return apiError('not_found', 'Project not found', 404);

  const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tpl = await db.template.create({
    data: {
      projectId: body.projectId,
      channel: body.channel,
      name: body.name,
      slug,
      description: body.description,
      subject: body.subject,
      body: body.body,
      variables: body.variables ? JSON.stringify(body.variables) : null,
      locale: body.locale,
      version: 1,
    },
  });
  return ok(tpl, 201);
}

export async function GET(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.templatesRead });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const channel = url.searchParams.get('channel');
  const { page, pageSize } = getPagination(req);
  const where = {
    project: { orgId: ctx.orgId },
    ...(projectId ? { projectId } : {}),
    ...(channel ? { channel } : {}),
  };
  const [data, total] = await Promise.all([
    db.template.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.template.count({ where }),
  ]);
  return ok(paginate(
    data.map((t) => ({ ...t, variables: t.variables ? JSON.parse(t.variables) : null })),
    page, pageSize, total,
  ));
}

export const dynamic = 'force-dynamic';
