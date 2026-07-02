import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticate, unauthorized } from '@/lib/infra/auth';
import { ok } from '@/lib/infra/api';
import { queueStats } from '@/lib/infra/queue';

/**
 * GET /api/v1/metrics — Prometheus-style plain text metrics.
 * Compatible with prometheus text exposition format.
 *
 * Production: exposes /metrics on each service for scraping by Prometheus.
 */
export async function GET(req: NextRequest) {
  // Open metrics endpoint — but we still require auth to avoid public scraping.
  // Real production deployments would use mTLS or IP allowlist.
  const accept = req.headers.get('accept') ?? '';
  const wantsPrometheus = accept.includes('text/plain');

  const ctx = await authenticate(req);
  if (!ctx) return unauthorized();

  const orgNotifications = await db.notification.count({ where: { orgId: ctx.orgId } });
  const orgDevices = await db.device.count({ where: { project: { orgId: ctx.orgId } } });
  const orgProjects = await db.project.count({ where: { orgId: ctx.orgId } });
  const orgApiKeys = await db.apiKey.count({ where: { orgId: ctx.orgId, status: 'active' } });

  // Per-status notification counts
  const byStatus = await db.notification.groupBy({
    by: ['status'],
    where: { orgId: ctx.orgId },
    _count: true,
  });
  const byChannel = await db.notification.groupBy({
    by: ['channel'],
    where: { orgId: ctx.orgId },
    _count: true,
  });

  const qs = queueStats();

  if (wantsPrometheus) {
    const lines: string[] = [];
    lines.push('# HELP notifyforge_notifications_total Total notifications per status');
    lines.push('# TYPE notifyforge_notifications_total gauge');
    for (const s of byStatus) {
      lines.push(`notifyforge_notifications_total{status="${s.status}"} ${s._count}`);
    }
    lines.push('# HELP notifyforge_notifications_by_channel Total notifications per channel');
    lines.push('# TYPE notifyforge_notifications_by_channel gauge');
    for (const c of byChannel) {
      lines.push(`notifyforge_notifications_by_channel{channel="${c.channel}"} ${c._count}`);
    }
    lines.push('# HELP notifyforge_devices_total Total registered devices');
    lines.push('# TYPE notifyforge_devices_total gauge');
    lines.push(`notifyforge_devices_total ${orgDevices}`);
    lines.push('# HELP notifyforge_queue_pending Pending jobs in worker queue');
    lines.push('# TYPE notifyforge_queue_pending gauge');
    lines.push(`notifyforge_queue_pending ${qs.pending}`);
    return new Response(lines.join('\n') + '\n', {
      headers: { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' },
    });
  }

  return ok({
    notifications: orgNotifications,
    devices: orgDevices,
    projects: orgProjects,
    apiKeys: orgApiKeys,
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count })),
    queue: qs,
  });
}

export const dynamic = 'force-dynamic';
