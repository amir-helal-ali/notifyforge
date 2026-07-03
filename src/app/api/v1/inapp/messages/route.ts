import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { authenticate, unauthorized } from '@/lib/infra/auth';
import { apiError, ok } from '@/lib/infra/api';

/**
 * GET /api/v1/inapp/messages?userId={externalUserId}&limit=
 * Returns the most recent in-app notifications for a user, oldest unread first.
 * The client SDK polls this endpoint (or subscribes via WebSocket).
 */
export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return unauthorized();
  if (!ctx.projectId) return apiError('no_project', 'API key must be bound to a project', 400);

  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  if (!userId) return apiError('validation_error', 'userId query parameter required', 422);
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50', 10));

  // In-app notifications are stored in the notifications table with channel='inapp'.
  // The user is identified by target.externalUserId.
  const notifications = await db.notification.findMany({
    where: {
      projectId: ctx.projectId,
      channel: 'inapp',
      status: { in: ['sent', 'delivered'] },
      target: { contains: `"externalUserId":"${userId}"` },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      payload: true,
      priority: true,
      externalId: true,
      createdAt: true,
    },
  });

  return ok({
    userId,
    messages: notifications.map((n) => ({
      id: n.id,
      ...JSON.parse(n.payload),
      priority: n.priority,
      externalId: n.externalId,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export const dynamic = 'force-dynamic';
