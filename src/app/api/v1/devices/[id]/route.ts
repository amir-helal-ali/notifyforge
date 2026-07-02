import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticate, unauthorized } from '@/lib/infra/auth';
import { apiError, ok } from '@/lib/infra/api';
import { writeAudit } from '@/lib/infra/audit';

/**
 * DELETE /api/v1/devices/[id] — invalidate (unregister) a device token.
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await authenticate(req);
  if (!authCtx) return unauthorized();
  if (!authCtx.projectId) return apiError('no_project', 'API key must be bound to a project', 400);

  const { id } = await ctx.params;
  const device = await db.device.findFirst({ where: { id, projectId: authCtx.projectId } });
  if (!device) return apiError('not_found', 'Device not found', 404);

  await db.device.update({
    where: { id },
    data: { tokenStatus: 'invalid', invalidatedAt: new Date() },
  });

  await writeAudit({
    orgId: authCtx.orgId,
    projectId: authCtx.projectId,
    action: 'device.invalidate',
    resource: id,
  });

  return ok({ id, tokenStatus: 'invalid' });
}

/**
 * GET /api/v1/devices/[id] — fetch a single device
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authCtx = await authenticate(req);
  if (!authCtx) return unauthorized();
  if (!authCtx.projectId) return apiError('no_project', 'API key must be bound to a project', 400);

  const { id } = await ctx.params;
  const device = await db.device.findFirst({
    where: { id, projectId: authCtx.projectId },
    include: { application: true },
  });
  if (!device) return apiError('not_found', 'Device not found', 404);

  return ok({
    ...device,
    tags: device.tags ? JSON.parse(device.tags) : [],
    attributes: device.attributes ? JSON.parse(device.attributes) : {},
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    invalidatedAt: device.invalidatedAt?.toISOString() ?? null,
    createdAt: device.createdAt.toISOString(),
    updatedAt: device.updatedAt.toISOString(),
  });
}
