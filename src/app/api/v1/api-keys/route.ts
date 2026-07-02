import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok, parseJson, getPagination, paginate } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';
import { generateApiKey } from '@/lib/infra/crypto';
import { ALL_SCOPES } from '@/lib/infra/auth';

/**
 * POST /api/v1/api-keys
 * Body: { projectId, applicationId?, name, scopes: string[], rateLimit?, expiresAt? }
 * Returns the full API key ONCE in the response (never retrievable again).
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.apikeysWrite, action: 'api_key.create' });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const body = await parseJson<{
    projectId: string;
    applicationId?: string;
    name: string;
    scopes?: string[];
    rateLimit?: number;
    expiresAt?: string;
  }>(req);
  if (!body?.projectId || !body?.name) return apiError('validation_error', 'projectId, name required', 422);

  const project = await db.project.findFirst({ where: { id: body.projectId, orgId: ctx.orgId } });
  if (!project) return apiError('not_found', 'Project not found', 404);

  if (body.applicationId) {
    const app = await db.application.findFirst({ where: { id: body.applicationId, projectId: body.projectId } });
    if (!app) return apiError('not_found', 'Application not found in project', 404);
  }

  // Validate scopes
  const scopes = body.scopes ?? ALL_SCOPES;
  const invalid = scopes.filter((s) => !ALL_SCOPES.includes(s as never) && s !== '*');
  if (invalid.length) return apiError('validation_error', `Invalid scopes: ${invalid.join(', ')}`, 422);

  const { fullKey, keyPrefix, keyHash } = generateApiKey();
  const apiKey = await db.apiKey.create({
    data: {
      orgId: ctx.orgId,
      projectId: body.projectId,
      applicationId: body.applicationId ?? null,
      userId: ctx.apiKeyId ? null : null, // don't tie dashboard-issued keys to a user by default
      keyPrefix,
      keyHash,
      name: body.name,
      scopes: JSON.stringify(scopes),
      rateLimit: body.rateLimit ?? 1000,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });

  return ok({
    id: apiKey.id,
    key: fullKey, // returned ONCE
    keyPrefix: apiKey.keyPrefix,
    name: apiKey.name,
    scopes,
    rateLimit: apiKey.rateLimit,
    expiresAt: apiKey.expiresAt?.toISOString() ?? null,
    createdAt: apiKey.createdAt.toISOString(),
  }, 201);
}

/**
 * GET /api/v1/api-keys?projectId=...
 * Lists API keys (without revealing the full key — only prefix).
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.apikeysRead });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const { page, pageSize } = getPagination(req);

  const where = {
    orgId: ctx.orgId,
    ...(projectId ? { projectId } : {}),
  };
  const [data, total] = await Promise.all([
    db.apiKey.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        scopes: true,
        rateLimit: true,
        status: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        application: { select: { id: true, name: true } },
      },
    }),
    db.apiKey.count({ where }),
  ]);
  return ok(paginate(
    data.map((k) => ({ ...k, scopes: JSON.parse(k.scopes) })),
    page, pageSize, total,
  ));
}

export const dynamic = 'force-dynamic';
