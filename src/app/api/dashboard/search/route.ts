import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

/**
 * GET /api/dashboard/search?q=...
 * Global search across notifications, devices, projects, applications, templates, api keys.
 */
export async function GET(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);

  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim();
  if (!q || q.length < 2) {
    return ok({ notifications: [], devices: [], projects: [], applications: [], templates: [], apiKeys: [] });
  }

  // SQLite LIKE is case-insensitive for ASCII; for production use full-text search.
  const [notifications, devices, projects, applications, templates, apiKeys] = await Promise.all([
    db.notification.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [
          { id: { contains: q } },
          { externalId: { contains: q } },
          { providerMessageId: { contains: q } },
          { errorCode: { contains: q } },
          { errorMessage: { contains: q } },
        ],
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, channel: true, status: true, priority: true, createdAt: true },
    }),
    db.device.findMany({
      where: {
        project: { orgId: ctx.orgId },
        OR: [
          { token: { contains: q } },
          { externalUserId: { contains: q } },
        ],
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: { id: true, channel: true, token: true, externalUserId: true, tokenStatus: true, createdAt: true },
    }),
    db.project.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [{ name: { contains: q } }, { slug: { contains: q } }, { description: { contains: q } }],
      },
      take: 10,
      select: { id: true, name: true, slug: true, description: true },
    }),
    db.application.findMany({
      where: {
        project: { orgId: ctx.orgId },
        OR: [{ name: { contains: q } }, { slug: { contains: q } }],
      },
      take: 10,
      select: { id: true, name: true, slug: true, platform: true },
    }),
    db.template.findMany({
      where: {
        project: { orgId: ctx.orgId },
        OR: [{ name: { contains: q } }, { slug: { contains: q } }, { body: { contains: q } }],
      },
      take: 10,
      select: { id: true, name: true, slug: true, channel: true },
    }),
    db.apiKey.findMany({
      where: {
        orgId: ctx.orgId,
        OR: [{ name: { contains: q } }, { keyPrefix: { contains: q } }],
      },
      take: 10,
      select: { id: true, name: true, keyPrefix: true, status: true },
    }),
  ]);

  return ok({
    notifications: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    devices: devices.map((d) => ({
      ...d, token: d.token.slice(0, 8) + '…',
      createdAt: d.createdAt.toISOString(),
    })),
    projects,
    applications,
    templates,
    apiKeys,
  });
}

export const dynamic = 'force-dynamic';
