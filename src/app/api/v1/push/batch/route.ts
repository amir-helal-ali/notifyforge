/**
 * POST /api/v1/push/batch
 * Send up to 1000 push notifications in a single request.
 * Body: { items: SendRequest[] }
 */

import { NextRequest } from 'next/server';
import { initChannels } from '@/lib/channels';
import { ingestBatch } from '@/lib/batch';
import { channelGuard } from '@/lib/infra/guard';
import { apiError, ok, parseJson } from '@/lib/infra/api';
import type { Channel } from '@/lib/types';

initChannels();

export async function POST(req: NextRequest) {
  const guarded = await channelGuard(req, 'push');
  if (!guarded.ok) return guarded.response;
  const { ctx } = guarded.data;

  const body = await parseJson<{ items: Array<{ channel?: 'push_android' | 'push_ios' | 'push_huawei'; target: unknown; payload: unknown; externalId?: string; priority?: 'low' | 'normal' | 'high' | 'critical'; scheduledAt?: string; ttlSeconds?: number; collapseKey?: string; tags?: string[] }> }>(req);
  if (!body?.items || !Array.isArray(body.items)) {
    return apiError('bad_request', 'items array required', 400);
  }

  const items = body.items.map((it) => ({
    channel: (it.channel ?? 'push_android') as Channel,
    target: it.target as never,
    payload: it.payload as never,
    externalId: it.externalId,
    priority: it.priority,
    scheduledAt: it.scheduledAt,
    ttlSeconds: it.ttlSeconds,
    collapseKey: it.collapseKey,
    tags: it.tags,
  }));

  const result = await ingestBatch(ctx, items);
  return ok(result, 202);
}

export const dynamic = 'force-dynamic';
