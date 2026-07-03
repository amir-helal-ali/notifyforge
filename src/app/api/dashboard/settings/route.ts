import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError, parseJson } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

/**
 * GET /api/dashboard/settings — returns organization + master project settings
 */
export async function GET() {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);

  const org = await db.organization.findUnique({
    where: { id: ctx.orgId },
    include: { _count: { select: { users: true, projects: true } } },
  });
  if (!org) return apiError('not_found', 'Organization not found', 404);

  const project = await db.project.findUnique({ where: { id: ctx.projectId } });

  return ok({
    organization: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      plan: org.plan,
      status: org.status,
      createdAt: org.createdAt.toISOString(),
      memberCount: org._count.users,
      projectCount: org._count.projects,
    },
    project: project ? {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      status: project.status,
    } : null,
    // Settings (would be stored in a Settings table in production)
    settings: {
      ipAllowlist: '',
      defaultRateLimit: 1000,
      webhookSigningKey: process.env.WEBHOOK_DEFAULT_SIGNING_KEY ? '••••••••' : 'not set',
      retentionDays: 90,
      enableRealtime: true,
      enableAnalytics: true,
      timezone: 'Africa/Cairo',
      locale: 'ar',
    },
  });
}

/**
 * PATCH /api/dashboard/settings — update organization settings
 */
export async function PATCH(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);

  const body = await parseJson<{
    name?: string;
    description?: string;
    plan?: string;
  }>(req);
  if (!body) return apiError('bad_request', 'Invalid JSON', 400);

  if (body.name !== undefined) {
    await db.organization.update({ where: { id: ctx.orgId }, data: { name: body.name } });
  }
  if (body.description !== undefined && ctx.projectId) {
    await db.project.update({ where: { id: ctx.projectId }, data: { description: body.description } });
  }

  return ok({ updated: true });
}

export const dynamic = 'force-dynamic';
