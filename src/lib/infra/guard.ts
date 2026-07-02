/**
 * Unified API middleware: authenticate → rate-limit → scope-check.
 * Returns either an AuthContext (success) or a Response (failure).
 */

import { authenticate, channelScope, requireScopes, unauthorized, forbidden } from '@/lib/infra/auth';
import { consumeRateLimit } from '@/lib/infra/rate-limit';
import { clientIp, userAgent, rateLimited } from '@/lib/infra/api';
import { writeAudit } from '@/lib/infra/audit';
import type { AuthContext } from '@/lib/types';

export interface GuardedRequest {
  ctx: AuthContext;
  ip: string | undefined;
  ua: string | undefined;
}

export async function guard(
  req: Request,
  opts: { requiredScope: string; action?: string },
): Promise<{ ok: true; data: GuardedRequest } | { ok: false; response: Response }> {
  const ctx = await authenticate(req);
  if (!ctx) return { ok: false, response: unauthorized() };

  if (!requireScopes(ctx, opts.requiredScope)) {
    return { ok: false, response: forbidden() };
  }

  const rl = await consumeRateLimit(`apikey:${ctx.apiKeyId}`, ctx.rateLimit);
  if (!rl.allowed) {
    return { ok: false, response: rateLimited(rl.resetAt) };
  }

  const ip = clientIp(req);
  const ua = userAgent(req);

  if (opts.action) {
    void writeAudit({
      orgId: ctx.orgId,
      projectId: ctx.projectId,
      action: opts.action,
      ip,
      userAgent: ua,
    });
  }

  return { ok: true, data: { ctx, ip, ua } };
}

export function channelGuard(req: Request, channel: string) {
  return guard(req, {
    requiredScope: channelScope(channel),
    action: `api.call.${channel}`,
  });
}
