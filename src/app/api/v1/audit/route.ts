import { NextRequest } from 'next/server';
import { listAudit } from '@/lib/infra/audit';
import { guard } from '@/lib/infra/guard';
import { ok } from '@/lib/infra/api';
import { SCOPES } from '@/lib/infra/auth';

export async function GET(req: NextRequest) {
  const g = await guard(req, { requiredScope: SCOPES.auditRead });
  if (!g.ok) return g.response;
  const { ctx } = g.data;
  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const action = url.searchParams.get('action') ?? undefined;
  const page = parseInt(url.searchParams.get('page') ?? '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') ?? '50', 10);
  const result = await listAudit({ orgId: ctx.orgId, projectId, action, page, pageSize });
  return ok(result);
}

export const dynamic = 'force-dynamic';
