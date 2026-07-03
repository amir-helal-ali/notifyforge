import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError, parseJson } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25', 10));
  const [data, total] = await Promise.all([
    db.project.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { applications: true, devices: true, notifications: true, apiKeys: true } } },
    }),
    db.project.count({ where: { orgId: ctx.orgId } }),
  ]);
  return ok({
    data: data.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const body = await parseJson<{ name: string; slug?: string; description?: string }>(req);
  if (!body?.name) return apiError('validation_error', 'name required', 422);
  const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const existing = await db.project.findUnique({ where: { orgId_slug: { orgId: ctx.orgId, slug } } });
  if (existing) return apiError('conflict', 'Project slug already exists', 409);
  const project = await db.project.create({
    data: { orgId: ctx.orgId, name: body.name, slug, description: body.description },
  });
  return ok({ ...project, createdAt: project.createdAt.toISOString() }, 201);
}

export const dynamic = 'force-dynamic';
