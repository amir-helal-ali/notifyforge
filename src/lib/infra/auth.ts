/**
 * Authentication & RBAC.
 *
 * NotifyForge authenticates every API request via the `Authorization: Bearer <api_key>`
 * header (or `x-api-key`). The key is looked up by its 16-char prefix and verified
 * via SHA-256 hash comparison. Scopes are enforced per-route.
 *
 * Scopes follow the pattern: `<channel>:<action>` (e.g. `push:send`, `email:send`)
 * or `admin:<resource>:<action>` (e.g. `admin:projects:create`).
 */

import { db } from '@/lib/db';
import { hashApiKey, safeEqual } from '@/lib/infra/crypto';
import type { AuthContext } from '@/lib/types';

export const SCOPES = {
  // Channel send scopes
  pushSend: 'push:send',
  emailSend: 'email:send',
  smsSend: 'sms:send',
  webpushSend: 'webpush:send',
  inappSend: 'inapp:send',
  webhookSend: 'webhook:send',
  desktopSend: 'desktop:send',
  // Management scopes
  projectsRead: 'admin:projects:read',
  projectsWrite: 'admin:projects:write',
  appsRead: 'admin:apps:read',
  appsWrite: 'admin:apps:write',
  apikeysRead: 'admin:apikeys:read',
  apikeysWrite: 'admin:apikeys:write',
  devicesRead: 'admin:devices:read',
  devicesWrite: 'admin:devices:write',
  templatesRead: 'admin:templates:read',
  templatesWrite: 'admin:templates:write',
  notificationsRead: 'admin:notifications:read',
  notificationsWrite: 'admin:notifications:write',
  analyticsRead: 'admin:analytics:read',
  auditRead: 'admin:audit:read',
} as const;

export const ALL_SCOPES = Object.values(SCOPES);

export function channelScope(channel: string): string {
  const map: Record<string, string> = {
    push_android: SCOPES.pushSend,
    push_ios: SCOPES.pushSend,
    push_huawei: SCOPES.pushSend,
    email: SCOPES.emailSend,
    sms: SCOPES.smsSend,
    webpush: SCOPES.webpushSend,
    inapp: SCOPES.inappSend,
    webhook: SCOPES.webhookSend,
    desktop: SCOPES.desktopSend,
  };
  return map[channel] ?? SCOPES.pushSend;
}

export async function authenticate(req: Request): Promise<AuthContext | null> {
  const auth =
    req.headers.get('authorization') ??
    req.headers.get('x-api-key') ??
    '';
  const raw = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (!raw) return null;
  if (raw.length < 20) return null;

  const keyPrefix = raw.slice(0, 16);
  const keyHash = hashApiKey(raw);

  const apiKey = await db.apiKey.findUnique({
    where: { keyPrefix },
    include: { organization: true },
  });
  if (!apiKey) return null;
  if (apiKey.status !== 'active') return null;
  if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) return null;
  if (!safeEqual(apiKey.keyHash, keyHash)) return null;
  if (apiKey.organization.status !== 'active') return null;

  // Touch lastUsedAt (fire-and-forget; debounce to 30s in production)
  void db.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => undefined);

  let scopes: string[];
  try {
    scopes = JSON.parse(apiKey.scopes);
  } catch {
    scopes = [];
  }

  return {
    orgId: apiKey.orgId,
    projectId: apiKey.projectId,
    applicationId: apiKey.applicationId,
    apiKeyId: apiKey.id,
    scopes,
    rateLimit: apiKey.rateLimit,
  };
}

export function requireScopes(ctx: AuthContext, required: string | string[]): boolean {
  const list = Array.isArray(required) ? required : [required];
  if (ctx.scopes.includes('*')) return true;
  return list.every((s) => ctx.scopes.includes(s));
}

export function unauthorized(): Response {
  return Response.json(
    { error: { code: 'unauthorized', message: 'Missing or invalid API key.' } },
    { status: 401 },
  );
}

export function forbidden(): Response {
  return Response.json(
    { error: { code: 'forbidden', message: 'API key lacks required scope.' } },
    { status: 403 },
  );
}
