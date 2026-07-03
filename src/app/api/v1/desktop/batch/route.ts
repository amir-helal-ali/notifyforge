import { NextRequest } from 'next/server';
import { initChannels } from '@/lib/channels';
import { ingestBatch } from '@/lib/batch';
import { channelGuard } from '@/lib/infra/guard';
import { apiError, ok, parseJson } from '@/lib/infra/api';

initChannels();

export async function POST(req: NextRequest) {
  const guarded = await channelGuard(req, 'desktop');
  if (!guarded.ok) return guarded.response;
  const body = await parseJson<{ items: Array<{ target: unknown; payload: unknown; externalId?: string; priority?: 'low' | 'normal' | 'high' | 'critical'; tags?: string[] }> }>(req);
  if (!body?.items || !Array.isArray(body.items)) return apiError('bad_request', 'items array required', 400);
  const result = await ingestBatch(guarded.data.ctx, body.items.map((it) => ({
    channel: 'desktop' as const, target: it.target as never, payload: it.payload as never,
    externalId: it.externalId, priority: it.priority, tags: it.tags,
  })));
  return ok(result, 202);
}

export const dynamic = 'force-dynamic';
