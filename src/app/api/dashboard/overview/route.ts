/**
 * Dashboard API — internal routes used by the in-app dashboard UI.
 * These routes operate with the bootstrap master API key context.
 *
 * They are NOT exposed as the public API surface; they exist only to
 * power the admin/developer dashboard built into the platform.
 */

import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError } from '@/lib/infra/api';
import { NextRequest } from 'next/server';

export async function GET() {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);

  const [projects, apps, apiKeys, devices, notifications, templates] = await Promise.all([
    db.project.count({ where: { orgId: ctx.orgId } }),
    db.application.count({ where: { project: { orgId: ctx.orgId } } }),
    db.apiKey.count({ where: { orgId: ctx.orgId, status: 'active' } }),
    db.device.count({ where: { project: { orgId: ctx.orgId } } }),
    db.notification.count({ where: { orgId: ctx.orgId } }),
    db.template.count({ where: { project: { orgId: ctx.orgId } } }),
  ]);

  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
  const last24h = await db.notification.count({
    where: { orgId: ctx.orgId, createdAt: { gte: dayAgo } },
  });

  const byChannel = await db.notification.groupBy({
    by: ['channel'],
    where: { orgId: ctx.orgId },
    _count: true,
  });
  const byStatus = await db.notification.groupBy({
    by: ['status'],
    where: { orgId: ctx.orgId },
    _count: true,
  });

  // Hourly series for last 24h
  const recent = await db.notification.findMany({
    where: { orgId: ctx.orgId, createdAt: { gte: dayAgo } },
    select: { createdAt: true, channel: true, status: true },
  });
  const series: Record<string, { bucket: string; count: number }[]> = {};
  const bucketMs = 60 * 60 * 1000;
  const channels = ['push_android', 'push_ios', 'push_huawei', 'webpush', 'email', 'sms', 'inapp', 'webhook', 'desktop'];
  for (const ch of channels) {
    series[ch] = [];
    for (let i = 23; i >= 0; i--) {
      const start = new Date(now - i * bucketMs - bucketMs);
      const end = new Date(now - i * bucketMs);
      const count = recent.filter((n) => n.channel === ch && n.createdAt >= start && n.createdAt < end).length;
      series[ch].push({ bucket: start.toISOString(), count });
    }
  }

  return ok({
    counts: { projects, apps, apiKeys, devices, notifications, templates, last24h },
    byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    series,
  });
}

export const dynamic = 'force-dynamic';
