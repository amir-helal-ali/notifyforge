/**
 * Dashboard context — reads the bootstrap master key file and exposes
 * a derived AuthContext for the in-app dashboard UI.
 *
 * In production the dashboard would be a separate Next.js app authenticated
 * via NextAuth + RBAC. Here we use the bootstrap state to power the demo.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/infra/logger';
import type { AuthContext } from '@/lib/types';

let cached: { orgId: string; projectId: string; applicationId: string; apiKeyId: string; fullKey: string; keyPrefix: string } | null = null;

export async function readMasterKeyContext(): Promise<{ orgId: string; projectId: string; applicationId: string; apiKeyId: string; fullKey: string; keyPrefix: string } | null> {
  if (cached) return cached;
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const file = path.join(process.cwd(), '.state', 'master-key.json');
    const raw = await fs.readFile(file, 'utf8');
    cached = JSON.parse(raw);
    return cached;
  } catch {
    // Try to bootstrap lazily
    try {
      const { bootstrap } = await import('@/../scripts/bootstrap');
      await bootstrap();
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const file = path.join(process.cwd(), '.state', 'master-key.json');
      const raw = await fs.readFile(file, 'utf8');
      cached = JSON.parse(raw);
      return cached;
    } catch (e) {
      logger.error('dashboard_context.failed', { error: (e as Error).message });
      return null;
    }
  }
}

export async function dashboardAuthContext(): Promise<AuthContext | null> {
  const ctx = await readMasterKeyContext();
  if (!ctx) return null;
  return {
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    applicationId: ctx.applicationId,
    apiKeyId: ctx.apiKeyId,
    scopes: ['*'],
    rateLimit: 100000,
  };
}

// Re-export db so consumers can import from one place
export { db };
