/**
 * POST /api/v1/push/send
 * Channel: push_android | push_ios | push_huawei
 * The client explicitly chooses the subchannel via `payload.channel` or
 * `target.channel`. The platform never re-routes.
 */

import { NextRequest } from 'next/server';
import { initChannels } from '@/lib/channels';
import { ingestNotification } from '@/lib/ingest';
import { channelGuard } from '@/lib/infra/guard';
import { apiError, ok, parseJson } from '@/lib/infra/api';
import type { Channel } from '@/lib/types';

initChannels();

export async function POST(req: NextRequest) {
  const guarded = await channelGuard(req, 'push');
  if (!guarded.ok) return guarded.response;
  const { ctx } = guarded.data;

  const body = await parseJson<{
    channel?: 'push_android' | 'push_ios' | 'push_huawei';
    target: unknown;
    payload: unknown;
    externalId?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    scheduledAt?: string;
    ttlSeconds?: number;
    collapseKey?: string;
    tags?: string[];
  }>(req);
  if (!body) return apiError('bad_request', 'Invalid JSON body', 400);

  const channel: Channel = body.channel ?? 'push_android';
  if (!['push_android', 'push_ios', 'push_huawei'].includes(channel)) {
    return apiError('validation_error', 'channel must be push_android | push_ios | push_huawei', 422);
  }

  const result = await ingestNotification(ctx, {
    channel,
    target: body.target as never,
    payload: body.payload as never,
    externalId: body.externalId,
    priority: body.priority,
    scheduledAt: body.scheduledAt,
    ttlSeconds: body.ttlSeconds,
    collapseKey: body.collapseKey,
    tags: body.tags,
  });
  if ('error' in result) return apiError(result.error.code, result.error.message, result.error.status);
  return ok(result.response, 202);
}
