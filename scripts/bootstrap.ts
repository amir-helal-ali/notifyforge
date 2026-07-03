/**
 * Bootstrap — seeds the platform with a default organization, project,
 * application, and a master API key. Idempotent — safe to run on every boot.
 *
 * The master API key is printed to the server log ONCE on first run.
 * Subsequent runs find the existing key by its keyPrefix and skip creation.
 */

import { db } from '@/lib/db';
import { generateApiKey } from '@/lib/infra/crypto';
import { ALL_SCOPES } from '@/lib/infra/auth';
import { logger } from '@/lib/infra/logger';

const DEFAULT_ORG_SLUG = 'notifyforge';
const DEFAULT_PROJECT_SLUG = 'demo';
const DEFAULT_APP_SLUG = 'demo-app';

export async function bootstrap(): Promise<void> {
  let org = await db.organization.findUnique({ where: { slug: DEFAULT_ORG_SLUG } });
  if (!org) {
    org = await db.organization.create({
      data: {
        slug: DEFAULT_ORG_SLUG,
        name: 'NotifyForge Demo Org',
        plan: 'enterprise',
        status: 'active',
      },
    });
    logger.info('bootstrap.org_created', { orgId: org.id, slug: org.slug });
  }

  let project = await db.project.findUnique({
    where: { orgId_slug: { orgId: org.id, slug: DEFAULT_PROJECT_SLUG } },
  });
  if (!project) {
    project = await db.project.create({
      data: {
        orgId: org.id,
        name: 'Demo Project',
        slug: DEFAULT_PROJECT_SLUG,
        description: 'Default project for the NotifyForge dashboard demo.',
      },
    });
    logger.info('bootstrap.project_created', { projectId: project.id });
  }

  let app = await db.application.findUnique({
    where: { projectId_slug: { projectId: project.id, slug: DEFAULT_APP_SLUG } },
  });
  if (!app) {
    app = await db.application.create({
      data: {
        projectId: project.id,
        name: 'Demo App',
        slug: DEFAULT_APP_SLUG,
        platform: 'mobile_android',
        description: 'Default application for the dashboard demo.',
      },
    });
    logger.info('bootstrap.app_created', { applicationId: app.id });
  }

  // Master API key — created once, prefix `nf_live_master` (we'll search by name)
  const MASTER_KEY_NAME = 'Master Dashboard Key';
  let apiKey = await db.apiKey.findFirst({
    where: { orgId: org.id, name: MASTER_KEY_NAME },
  });
  if (!apiKey) {
    const { fullKey, keyPrefix, keyHash } = generateApiKey();
    apiKey = await db.apiKey.create({
      data: {
        orgId: org.id,
        projectId: project.id,
        applicationId: app.id,
        keyPrefix,
        keyHash,
        name: MASTER_KEY_NAME,
        scopes: JSON.stringify(ALL_SCOPES),
        rateLimit: 100000,
      },
    });
    // Persist to a file so the dashboard UI can read it
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const stateDir = path.join(process.cwd(), '.state');
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(
      path.join(stateDir, 'master-key.json'),
      JSON.stringify({
        orgId: org.id,
        projectId: project.id,
        applicationId: app.id,
        apiKeyId: apiKey.id,
        fullKey,
        keyPrefix,
      }, null, 2),
      { mode: 0o600 },
    );
    logger.info('bootstrap.apikey_created', { apiKeyId: apiKey.id, keyPrefix });
  }

  // Seed a few sample notifications across channels for visualization
  const ncount = await db.notification.count({ where: { projectId: project.id } });
  if (ncount === 0) {
    const channels = ['push_android', 'push_ios', 'email', 'sms', 'webpush', 'inapp', 'webhook', 'desktop'] as const;
    const statuses = ['delivered', 'delivered', 'delivered', 'sent', 'failed', 'queued', 'cancelled'] as const;
    const now = Date.now();
    for (let i = 0; i < 60; i++) {
      const ch = channels[i % channels.length]!;
      const st = statuses[i % statuses.length]!;
      const createdAt = new Date(now - (60 - i) * 5 * 60 * 1000);
      const sentAt = st === 'sent' || st === 'delivered' ? new Date(createdAt.getTime() + Math.random() * 5000) : null;
      const deliveredAt = st === 'delivered' ? new Date((sentAt ?? createdAt).getTime() + Math.random() * 3000) : null;
      const failedAt = st === 'failed' ? new Date(createdAt.getTime() + 2000) : null;
      await db.notification.create({
        data: {
          orgId: org.id,
          projectId: project.id,
          applicationId: app.id,
          channel: ch,
          status: st,
          priority: i % 10 === 0 ? 'high' : 'normal',
          payload: JSON.stringify({ title: `Notification ${i}`, body: `Demo notification #${i} via ${ch}` }),
          target: JSON.stringify({ externalUserId: 'demo-user' }),
          provider: ch.startsWith('push_android') ? 'fcm' : ch.startsWith('push_ios') ? 'apns' : ch.startsWith('push_huawei') ? 'huawei' : ch,
          providerMessageId: st === 'delivered' || st === 'sent' ? `${ch}:${i}` : null,
          attemptCount: st === 'failed' ? 3 : 1,
          maxAttempts: 3,
          sentAt,
          deliveredAt,
          failedAt,
          errorCode: st === 'failed' ? 'provider_error' : null,
          errorMessage: st === 'failed' ? 'Simulated provider error for demo' : null,
          createdAt,
          updatedAt: createdAt,
        },
      });
    }
    logger.info('bootstrap.sample_notifications_seeded', { count: 60 });
  }
}
