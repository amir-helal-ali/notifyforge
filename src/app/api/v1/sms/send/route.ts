import { NextRequest } from 'next/server';
import { initChannels } from '@/lib/channels';
import { ingestNotification } from '@/lib/ingest';
import { channelGuard } from '@/lib/infra/guard';
import { apiError, ok, parseJson } from '@/lib/infra/api';

initChannels();

export async function POST(req: NextRequest) {
  const guarded = await channelGuard(req, 'sms');
  if (!guarded.ok) return guarded.response;
  const body = await parseJson<{ target: unknown; payload: unknown; externalId?: string; priority?: 'low' | 'normal' | 'high' | 'critical'; scheduledAt?: string; tags?: string[] }>(req);
  if (!body) return apiError('bad_request', 'Invalid JSON body', 400);
  const result = await ingestNotification(guarded.data.ctx, {
    channel: 'sms',
    target: body.target as never,
    payload: body.payload as never,
    externalId: body.externalId,
    priority: body.priority,
    scheduledAt: body.scheduledAt,
    tags: body.tags,
  });
  if ('error' in result) return apiError(result.error.code, result.error.message, result.error.status);
  return ok(result.response, 202);
}
