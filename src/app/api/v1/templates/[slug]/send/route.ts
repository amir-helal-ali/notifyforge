/**
 * POST /api/v1/templates/{slug}/send
 * Renders the template with the provided variables and dispatches via the template's channel.
 *
 * Body: {
 *   target: TargetSpec,
 *   variables: { name: "Sarah", orderId: "12345", ... },
 *   externalId?: string,
 *   priority?: 'low'|'normal'|'high'|'critical',
 *   scheduledAt?: string,
 *   tags?: string[]
 * }
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { initChannels } from '@/lib/channels';
import { ingestNotification } from '@/lib/ingest';
import { guard } from '@/lib/infra/guard';
import { apiError, ok, parseJson } from '@/lib/infra/api';
import { SCOPES, channelScope } from '@/lib/infra/auth';
import { renderFullTemplate } from '@/lib/template-engine';
import { logger } from '@/lib/infra/logger';

initChannels();

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const g = await guard(req, { requiredScope: SCOPES.templatesRead });
  if (!g.ok) return g.response;
  const { ctx: authCtx } = g.data;

  if (!authCtx.projectId) {
    return apiError('no_project', 'API key must be bound to a project', 400);
  }

  // Find the latest active version of the template by slug
  const template = await db.template.findFirst({
    where: { projectId: authCtx.projectId, slug, status: 'active' },
    orderBy: { version: 'desc' },
  });
  if (!template) {
    return apiError('not_found', `Template '${slug}' not found in this project`, 404);
  }

  // Check the caller has the scope to send via this channel
  const requiredScope = channelScope(template.channel);
  if (!authCtx.scopes.includes('*') && !authCtx.scopes.includes(requiredScope)) {
    return apiError('forbidden', `API key lacks scope ${requiredScope}`, 403);
  }

  const body = await parseJson<{
    target: unknown;
    variables?: Record<string, unknown>;
    externalId?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    scheduledAt?: string;
    tags?: string[];
  }>(req);
  if (!body?.target) {
    return apiError('validation_error', 'target required', 422);
  }

  // Render the template
  const rendered = renderFullTemplate(
    { subject: template.subject, body: template.body },
    body.variables ?? {},
  );

  if (rendered.missing.length > 0) {
    logger.warn('template.missing_variables', { slug, missing: rendered.missing });
  }

  // Build the channel-specific payload from the rendered template.
  // Each channel has its own payload schema; the template body maps to the
  // most relevant field (e.g. body for push, html for email, body for sms).
  let payload: unknown;
  switch (template.channel) {
    case 'email':
      payload = {
        from: 'notifications@notifyforge.dev', // default; override per template in production
        to: (body.target as { email?: string }).email ?? '',
        subject: rendered.subject ?? template.name,
        html: rendered.body,
        text: rendered.body.replace(/<[^>]+>/g, ''),
        category: `template:${template.slug}`,
      };
      break;
    case 'sms':
      payload = {
        to: (body.target as { phone?: string }).phone ?? '',
        body: rendered.body,
      };
      break;
    case 'push_android':
      payload = {
        title: rendered.subject ?? template.name,
        body: rendered.body,
      };
      break;
    case 'push_ios':
      payload = {
        alert: { title: rendered.subject ?? template.name, body: rendered.body },
        sound: 'default',
      };
      break;
    case 'push_huawei':
      payload = {
        message: {
          notification: { title: rendered.subject ?? template.name, body: rendered.body },
        },
      };
      break;
    case 'webpush':
      payload = {
        title: rendered.subject ?? template.name,
        body: rendered.body,
      };
      break;
    case 'inapp':
      payload = {
        userId: (body.target as { externalUserId?: string }).externalUserId ?? '',
        title: rendered.subject ?? template.name,
        body: rendered.body,
      };
      break;
    case 'webhook':
      payload = {
        url: 'https://example.com/webhook',
        method: 'POST',
        body: { subject: rendered.subject, body: rendered.body, variables: body.variables },
      };
      break;
    case 'desktop':
      payload = {
        title: rendered.subject ?? template.name,
        body: rendered.body,
      };
      break;
    default:
      return apiError('invalid_channel', `Template channel ${template.channel} not supported`, 400);
  }

  const result = await ingestNotification(authCtx, {
    channel: template.channel as never,
    target: body.target as never,
    payload: payload as never,
    externalId: body.externalId,
    priority: body.priority,
    scheduledAt: body.scheduledAt,
    tags: [...(body.tags ?? []), `template:${template.slug}`],
  });

  if ('error' in result) return apiError(result.error.code, result.error.message, result.error.status);

  // Track template usage
  await db.notificationLog.create({
    data: {
      notificationId: result.response.id,
      level: 'info',
      stage: 'template',
      message: `Rendered from template '${template.slug}' v${template.version}. Missing vars: ${rendered.missing.length > 0 ? rendered.missing.join(', ') : 'none'}`,
    },
  }).catch(() => undefined);

  return ok(result.response, 202);
}

export const dynamic = 'force-dynamic';
