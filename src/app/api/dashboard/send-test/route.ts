import { NextRequest } from 'next/server';
import { initChannels } from '@/lib/channels';
import { ingestNotification } from '@/lib/ingest';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError, parseJson } from '@/lib/infra/api';
import { ALL_SCOPES } from '@/lib/infra/auth';
import type { AuthContext, Channel } from '@/lib/types';

initChannels();

/**
 * POST /api/dashboard/send-test
 * Body: { channel, target, payload }
 * Sends a test notification using the master dashboard key.
 */
export async function POST(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);

  const body = await parseJson<{
    channel: Channel;
    target: unknown;
    payload: unknown;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    externalId?: string;
  }>(req);
  if (!body?.channel || !body?.target || !body?.payload) {
    return apiError('validation_error', 'channel, target, payload required', 422);
  }

  // Construct an AuthContext from the bootstrap state
  const authCtx: AuthContext = {
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    applicationId: ctx.applicationId,
    apiKeyId: ctx.apiKeyId,
    scopes: ALL_SCOPES,
    rateLimit: 100000,
  };

  const result = await ingestNotification(authCtx, {
    channel: body.channel,
    target: body.target as never,
    payload: body.payload as never,
    externalId: body.externalId ?? `test-${Date.now()}`,
    priority: body.priority ?? 'normal',
  });

  if ('error' in result) return apiError(result.error.code, result.error.message, result.error.status);
  return ok(result.response, 202);
}

export const dynamic = 'force-dynamic';
