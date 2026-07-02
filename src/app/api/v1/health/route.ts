import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { ok } from '@/lib/infra/api';

/**
 * GET /api/v1/health — liveness/readiness probe.
 */
export async function GET() {
  let dbOk = true;
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbOk = false;
  }
  return ok({
    status: dbOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: { database: dbOk ? 'up' : 'down' },
    version: process.env.npm_package_version ?? '1.0.0',
  });
}
