import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError, parseJson } from '@/lib/infra/api';
import { NextRequest } from 'next/server';
import { randomId } from '@/lib/infra/crypto';

/**
 * GET /api/dashboard/team — list organization members
 */
export async function GET() {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);

  const users = await db.user.findMany({
    where: { orgId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, name: true, role: true, status: true,
      lastLoginAt: true, createdAt: true,
    },
  });

  return ok({
    data: users.map((u) => ({
      ...u,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/dashboard/team — invite a new team member
 */
export async function POST(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);

  const body = await parseJson<{
    email: string;
    name?: string;
    role?: 'owner' | 'admin' | 'developer' | 'viewer';
  }>(req);
  if (!body?.email) return apiError('validation_error', 'email required', 422);

  const role = body.role ?? 'developer';
  if (!['owner', 'admin', 'developer', 'viewer'].includes(role)) {
    return apiError('validation_error', 'invalid role', 422);
  }

  const existing = await db.user.findUnique({ where: { email: body.email } });
  if (existing) return apiError('conflict', 'User with this email already exists', 409);

  // Generate a temporary password (in production: send invite email with magic link)
  const tempPassword = randomId('pass_');

  const user = await db.user.create({
    data: {
      orgId: ctx.orgId,
      email: body.email,
      name: body.name,
      passwordHash: tempPassword, // In production: bcrypt hash
      role,
    },
  });

  return ok({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    tempPassword, // Returned only for demo; in production send via email
  }, 201);
}

export const dynamic = 'force-dynamic';
