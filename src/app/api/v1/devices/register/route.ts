import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticate, unauthorized } from '@/lib/infra/auth';
import { apiError, ok, parseJson } from '@/lib/infra/api';
import { writeAudit } from '@/lib/infra/audit';
import { logger } from '@/lib/infra/logger';

/**
 * POST /api/v1/devices/register
 * Body: { applicationId, channel, token, externalUserId?, platform?, appVersion?, language?, timezone?, tags?, attributes? }
 * Registers or refreshes a device token. Idempotent on (applicationId, channel, token).
 */
export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return unauthorized();
  if (!ctx.projectId) return apiError('no_project', 'API key must be bound to a project', 400);

  const body = await parseJson<{
    applicationId?: string;
    channel: string;
    token: string;
    externalUserId?: string;
    platform?: string;
    appVersion?: string;
    language?: string;
    timezone?: string;
    tags?: string[];
    attributes?: Record<string, unknown>;
  }>(req);
  if (!body) return apiError('bad_request', 'Invalid JSON body', 400);

  const allowedChannels = ['push_android', 'push_ios', 'push_huawei', 'webpush', 'desktop', 'inapp'];
  if (!allowedChannels.includes(body.channel)) {
    return apiError('validation_error', `channel must be one of: ${allowedChannels.join(', ')}`, 422);
  }
  if (!body.token || body.token.length < 8) {
    return apiError('validation_error', 'token must be at least 8 chars', 422);
  }

  const applicationId = body.applicationId ?? ctx.applicationId;
  if (!applicationId) {
    return apiError('validation_error', 'applicationId is required (set via API key or body)', 422);
  }

  // Verify the application belongs to the API key's project
  const app = await db.application.findFirst({
    where: { id: applicationId, projectId: ctx.projectId },
  });
  if (!app) return apiError('not_found', 'Application not found in project', 404);

  const existing = await db.device.findUnique({
    where: {
      applicationId_channel_token: {
        applicationId,
        channel: body.channel,
        token: body.token,
      },
    },
  });

  let device;
  if (existing) {
    device = await db.device.update({
      where: { id: existing.id },
      data: {
        tokenStatus: 'active',
        externalUserId: body.externalUserId ?? existing.externalUserId,
        platform: body.platform ?? existing.platform,
        appVersion: body.appVersion ?? existing.appVersion,
        language: body.language ?? existing.language,
        timezone: body.timezone ?? existing.timezone,
        tags: body.tags ? JSON.stringify(body.tags) : existing.tags,
        attributes: body.attributes ? JSON.stringify(body.attributes) : existing.attributes,
        lastSeenAt: new Date(),
        invalidatedAt: null,
      },
    });
  } else {
    device = await db.device.create({
      data: {
        projectId: ctx.projectId,
        applicationId,
        channel: body.channel,
        token: body.token,
        externalUserId: body.externalUserId,
        platform: body.platform,
        appVersion: body.appVersion,
        language: body.language,
        timezone: body.timezone,
        tags: body.tags ? JSON.stringify(body.tags) : null,
        attributes: body.attributes ? JSON.stringify(body.attributes) : null,
        lastSeenAt: new Date(),
      },
    });
  }

  await writeAudit({
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    action: 'device.register',
    resource: device.id,
    meta: { channel: device.channel, applicationId },
  });
  logger.info('device.registered', { deviceId: device.id, channel: device.channel });

  return ok({
    id: device.id,
    channel: device.channel,
    tokenStatus: device.tokenStatus,
    createdAt: device.createdAt.toISOString(),
  });
}

/**
 * GET /api/v1/devices?channel=&externalUserId=&status=&page=&pageSize=
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return unauthorized();
  if (!ctx.projectId) return apiError('no_project', 'API key must be bound to a project', 400);

  const url = new URL(req.url);
  const channel = url.searchParams.get('channel') ?? undefined;
  const externalUserId = url.searchParams.get('externalUserId') ?? undefined;
  const status = url.searchParams.get('status') ?? undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '50', 10)));

  const where = {
    projectId: ctx.projectId,
    ...(channel ? { channel } : {}),
    ...(externalUserId ? { externalUserId } : {}),
    ...(status ? { tokenStatus: status } : {}),
  };
  const [data, total] = await Promise.all([
    db.device.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        channel: true,
        token: true,
        tokenStatus: true,
        externalUserId: true,
        platform: true,
        appVersion: true,
        language: true,
        tags: true,
        lastSeenAt: true,
        createdAt: true,
      },
    }),
    db.device.count({ where }),
  ]);

  return ok({
    data: data.map((d) => ({
      ...d,
      tags: d.tags ? JSON.parse(d.tags) : [],
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  });
}
