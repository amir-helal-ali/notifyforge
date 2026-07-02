/**
 * POST /api/v1/templates/{slug}/preview
 * Renders the template with sample variables and returns the rendered output without sending.
 */

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { guard } from '@/lib/infra/guard';
import { apiError, ok, parseJson } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';
import { renderFullTemplate } from '@/lib/template-engine';

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const g = await guard(req, { requiredScope: SCOPES.templatesRead });
  if (!g.ok) return g.response;
  const { ctx: authCtx } = g.data;
  if (!authCtx.projectId) return apiError('no_project', 'API key must be bound to a project', 400);

  const template = await db.template.findFirst({
    where: { projectId: authCtx.projectId, slug, status: 'active' },
    orderBy: { version: 'desc' },
  });
  if (!template) return apiError('not_found', `Template '${slug}' not found`, 404);

  const body = await parseJson<{ variables?: Record<string, unknown> }>(req);
  const rendered = renderFullTemplate(
    { subject: template.subject, body: template.body },
    body?.variables ?? {},
  );

  return ok({
    slug: template.slug,
    version: template.version,
    channel: template.channel,
    subject: rendered.subject,
    body: rendered.body,
    missing: rendered.missing,
  });
}

export const dynamic = 'force-dynamic';
