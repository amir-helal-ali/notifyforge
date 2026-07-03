import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { ok } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';

/**
 * GET /api/v1/analytics/summary?projectId=&channel=&from=&to=
 * Returns per-channel counts and latency metrics aggregated from the notifications table.
 *
 * Production: backed by ClickHouse with a materialized rollup table.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.analyticsRead });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');

  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = toStr ? new Date(toStr) : new Date();

  const where = {
    orgId: ctx.orgId,
    createdAt: { gte: from, lte: to },
    ...(projectId ? { projectId } : {}),
  };

  // Per-channel aggregation
  const all = await db.notification.findMany({
    where,
    select: { channel: true, status: true, createdAt: true, sentAt: true, deliveredAt: true },
  });

  const channels: Record<string, {
    total: number;
    queued: number;
    processing: number;
    sent: number;
    delivered: number;
    failed: number;
    cancelled: number;
    deliveryRate: number;
  }> = {};

  for (const n of all) {
    if (!channels[n.channel]) {
      channels[n.channel] = { total: 0, queued: 0, processing: 0, sent: 0, delivered: 0, failed: 0, cancelled: 0, deliveryRate: 0 };
    }
    const c = channels[n.channel];
    c.total++;
    c[n.status as 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'cancelled']++;
  }
  for (const c of Object.values(channels)) {
    c.deliveryRate = c.total > 0 ? (c.delivered + c.sent) / c.total : 0;
  }

  const total = all.length;
  const delivered = all.filter((n) => n.status === 'delivered' || n.status === 'sent').length;
  const failed = all.filter((n) => n.status === 'failed').length;

  // Time series (hourly buckets)
  const series: { bucket: string; count: number }[] = [];
  const bucketMs = 60 * 60 * 1000;
  const startBucket = Math.floor(from.getTime() / bucketMs) * bucketMs;
  for (let t = startBucket; t <= to.getTime(); t += bucketMs) {
    const next = t + bucketMs;
    const count = all.filter((n) => n.createdAt.getTime() >= t && n.createdAt.getTime() < next).length;
    series.push({ bucket: new Date(t).toISOString(), count });
  }

  return ok({
    range: { from: from.toISOString(), to: to.toISOString() },
    total,
    delivered,
    failed,
    deliveryRate: total > 0 ? delivered / total : 0,
    channels,
    series,
  });
}

export const dynamic = 'force-dynamic';
