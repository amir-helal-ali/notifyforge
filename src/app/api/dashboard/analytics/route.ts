import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);
  const url = new URL(req.url);
  const range = url.searchParams.get('range') ?? '24h';
  const now = Date.now();
  const from = new Date(now - (range === '7d' ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000));

  const all = await db.notification.findMany({
    where: { orgId: ctx.orgId, createdAt: { gte: from } },
    select: { channel: true, status: true, createdAt: true, sentAt: true, deliveredAt: true, priority: true },
  });

  // Per-channel success/failure breakdown
  const channels: Record<string, { total: number; delivered: number; failed: number; pending: number; deliveryRate: number }> = {};
  for (const n of all) {
    if (!channels[n.channel]) channels[n.channel] = { total: 0, delivered: 0, failed: 0, pending: 0, deliveryRate: 0 };
    const c = channels[n.channel];
    c.total++;
    if (n.status === 'delivered' || n.status === 'sent') c.delivered++;
    else if (n.status === 'failed') c.failed++;
    else c.pending++;
  }
  for (const c of Object.values(channels)) c.deliveryRate = c.total > 0 ? c.delivered / c.total : 0;

  // Latency stats (sentAt - createdAt)
  const latencies = all
    .filter((n) => n.sentAt)
    .map((n) => n.sentAt!.getTime() - n.createdAt.getTime())
    .sort((a, b) => a - b);
  const p = (q: number) => (latencies.length ? latencies[Math.floor(latencies.length * q)] ?? 0 : 0);

  // Series bucketed hourly
  const bucketMs = 60 * 60 * 1000;
  const bucketCount = range === '7d' ? 24 * 7 : 24;
  const series: { bucket: string; total: number; delivered: number; failed: number }[] = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const start = new Date(now - (i + 1) * bucketMs);
    const end = new Date(now - i * bucketMs);
    const inBucket = all.filter((n) => n.createdAt >= start && n.createdAt < end);
    series.push({
      bucket: start.toISOString(),
      total: inBucket.length,
      delivered: inBucket.filter((n) => n.status === 'delivered' || n.status === 'sent').length,
      failed: inBucket.filter((n) => n.status === 'failed').length,
    });
  }

  return ok({
    range,
    total: all.length,
    delivered: all.filter((n) => n.status === 'delivered' || n.status === 'sent').length,
    failed: all.filter((n) => n.status === 'failed').length,
    pending: all.filter((n) => n.status === 'queued' || n.status === 'processing').length,
    deliveryRate: all.length > 0 ? all.filter((n) => n.status === 'delivered' || n.status === 'sent').length / all.length : 0,
    latencyMs: { p50: p(0.5), p90: p(0.9), p99: p(0.99), avg: latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0 },
    channels,
    series,
  });
}

export const dynamic = 'force-dynamic';
