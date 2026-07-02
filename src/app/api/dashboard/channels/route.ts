import { db } from '@/lib/db';
import { readMasterKeyContext } from '@/lib/dashboard-context';
import { ok, apiError } from '@/lib/infra/api';

export async function GET() {
  const ctx = await readMasterKeyContext();
  if (!ctx) return apiError('not_bootstrapped', 'Platform not bootstrapped', 500);

  const channels = [
    { id: 'push_android', name: 'Android Push (FCM)', provider: 'fcm', endpoint: '/api/v1/push/send', scope: 'push:send' },
    { id: 'push_ios', name: 'iOS Push (APNs)', provider: 'apns', endpoint: '/api/v1/push/send', scope: 'push:send' },
    { id: 'push_huawei', name: 'Huawei Push (HMS)', provider: 'huawei', endpoint: '/api/v1/push/send', scope: 'push:send' },
    { id: 'webpush', name: 'Web Push', provider: 'webpush', endpoint: '/api/v1/webpush/send', scope: 'webpush:send' },
    { id: 'email', name: 'Email', provider: 'sendgrid', endpoint: '/api/v1/email/send', scope: 'email:send' },
    { id: 'sms', name: 'SMS', provider: 'twilio', endpoint: '/api/v1/sms/send', scope: 'sms:send' },
    { id: 'inapp', name: 'In-App', provider: 'inapp', endpoint: '/api/v1/inapp/send', scope: 'inapp:send' },
    { id: 'webhook', name: 'Webhook', provider: 'http', endpoint: '/api/v1/webhook/send', scope: 'webhook:send' },
    { id: 'desktop', name: 'Desktop', provider: 'desktop', endpoint: '/api/v1/desktop/send', scope: 'desktop:send' },
  ];

  // Add live counts per channel
  const counts = await db.notification.groupBy({
    by: ['channel'],
    where: { orgId: ctx.orgId },
    _count: true,
  });
  const countMap = new Map(counts.map((c) => [c.channel, c._count]));

  return ok(
    channels.map((c) => ({
      ...c,
      totalSent: countMap.get(c.id) ?? 0,
    })),
  );
}

export const dynamic = 'force-dynamic';
