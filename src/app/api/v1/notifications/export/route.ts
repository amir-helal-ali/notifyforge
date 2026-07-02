/**
 * GET /api/v1/notifications/export?format=csv|json&channel=&status=&from=&to=
 * Exports notifications as a downloadable file.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';

export async function GET(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.notificationsRead });
  if (!g.ok) return g.response;
  const { ctx: authCtx } = g.data;

  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'csv';
  const channel = url.searchParams.get('channel');
  const status = url.searchParams.get('status');
  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');

  if (format !== 'csv' && format !== 'json') {
    return apiError('validation_error', 'format must be csv or json', 422);
  }

  const where = {
    orgId: authCtx.orgId,
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(fromStr || toStr ? {
      createdAt: {
        ...(fromStr ? { gte: new Date(fromStr) } : {}),
        ...(toStr ? { lte: new Date(toStr) } : {}),
      },
    } : {}),
  };

  // Cap export at 50k rows to protect the server
  const rows = await db.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50000,
    select: {
      id: true, channel: true, status: true, priority: true, externalId: true,
      provider: true, providerMessageId: true, attemptCount: true, maxAttempts: true,
      errorCode: true, errorMessage: true,
      createdAt: true, sentAt: true, deliveredAt: true, failedAt: true,
    },
  });

  if (format === 'json') {
    return new Response(JSON.stringify(rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      sentAt: r.sentAt?.toISOString() ?? null,
      deliveredAt: r.deliveredAt?.toISOString() ?? null,
      failedAt: r.failedAt?.toISOString() ?? null,
    })), null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="notifications-${Date.now()}.json"`,
      },
    });
  }

  // CSV
  const headers = ['id', 'channel', 'status', 'priority', 'externalId', 'provider', 'providerMessageId', 'attemptCount', 'maxAttempts', 'errorCode', 'errorMessage', 'createdAt', 'sentAt', 'deliveredAt', 'failedAt'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const row = [
      r.id, r.channel, r.status, r.priority, r.externalId ?? '',
      r.provider ?? '', r.providerMessageId ?? '',
      String(r.attemptCount), String(r.maxAttempts),
      r.errorCode ?? '', csvEscape(r.errorMessage ?? ''),
      r.createdAt.toISOString(),
      r.sentAt?.toISOString() ?? '',
      r.deliveredAt?.toISOString() ?? '',
      r.failedAt?.toISOString() ?? '',
    ];
    lines.push(row.join(','));
  }
  return new Response('\ufeff' + lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="notifications-${Date.now()}.csv"`,
    },
  });
}

export const dynamic = 'force-dynamic';

function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
