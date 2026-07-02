import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError, parseJson } from '@/lib/infra/api';
import { NextRequest } from 'next/server';
import { generateApiKey } from '@/lib/infra/crypto';
import { ALL_SCOPES } from '@/lib/infra/auth';

export async function GET(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = Math.min(100, parseInt(url.searchParams.get('pageSize') ?? '25', 10));
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
        id: true, keyPrefix: true, name: true, scopes: true, rateLimit: true, status: true,
        lastUsedAt: true, expiresAt: true, createdAt: true,
        project: { select: { id: true, name: true } },
        application: { select: { id: true, name: true } },
      },
    }),
    db.apiKey.count({ where }),
  ]);
  return ok({
    data: data.map((k) => ({
      ...k,
      scopes: JSON.parse(k.scopes),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      expiresAt: k.expiresAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  });
}

export async function POST(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
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
    if (!app) return apiError('not_found', 'Application not found', 404);
  }
  const scopes = body.scopes ?? ALL_SCOPES;
  const { fullKey, keyPrefix, keyHash } = generateApiKey();
  const apiKey = await db.apiKey.create({
    data: {
      orgId: ctx.orgId,
      projectId: body.projectId,
      applicationId: body.applicationId ?? null,
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
    key: fullKey,
    keyPrefix: apiKey.keyPrefix,
    name: apiKey.name,
    scopes,
    rateLimit: apiKey.rateLimit,
    createdAt: apiKey.createdAt.toISOString(),
  }, 201);
}

export async function DELETE(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return apiError('validation_error', 'id query parameter required', 422);
  const apiKey = await db.apiKey.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!apiKey) return apiError('not_found', 'API key not found', 404);
  await db.apiKey.update({ where: { id }, data: { status: 'revoked' } });
  return ok({ id, status: 'revoked' });
}

export const dynamic = 'force-dynamic';
