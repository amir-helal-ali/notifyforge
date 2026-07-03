import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError, parseJson } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const channel = url.searchParams.get('channel') ?? undefined;
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25', 10));
  const where = {
    project: { orgId: ctx.orgId },
    ...(projectId ? { projectId } : {}),
    ...(channel ? { channel } : {}),
  };
  const [data, total] = await Promise.all([
    db.template.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.template.count({ where }),
  ]);
  return ok({
    data: data.map((t) => ({
      ...t,
      variables: t.variables ? JSON.parse(t.variables) : null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const body = await parseJson<{ projectId: string; channel: string; name: string; slug?: string; subject?: string; body: string; variables?: Record<string, unknown>; description?: string }>(req);
  if (!body?.projectId || !body?.channel || !body?.name || !body?.body) return apiError('validation_error', 'projectId, channel, name, body required', 422);
  const project = await db.project.findFirst({ where: { id: body.projectId, orgId: ctx.orgId } });
  if (!project) return apiError('not_found', 'Project not found', 404);
  const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = await db.template.findFirst({ where: { projectId: body.projectId, slug } });
  if (existing) return apiError('conflict', 'Template slug already exists', 409);
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
      version: 1,
    },
  });
  return ok({ ...tpl, createdAt: tpl.createdAt.toISOString() }, 201);
}

export const dynamic = 'force-dynamic';
