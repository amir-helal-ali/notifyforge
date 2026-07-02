/**
 * Audit logger — every mutating API call produces an AuditLog entry.
 * Audit logs are immutable and project-scoped.
 */

import { db } from '@/lib/db';

export async function writeAudit(opts: {
  orgId: string;
  userId?: string | null;
  projectId?: string | null;
  action: string;
  resource?: string;
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        orgId: opts.orgId,
        userId: opts.userId ?? null,
        projectId: opts.projectId ?? null,
        action: opts.action,
        resource: opts.resource ?? null,
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
        meta: opts.meta ? JSON.stringify(opts.meta) : null,
      },
    });
  } catch (e) {
    // Audit failures must never break the request flow.
    console.error('[audit] write failed', e);
  }
}

export async function listAudit(opts: {
  orgId: string;
  projectId?: string;
  action?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = opts.page ?? 1;
  const pageSize = Math.min(opts.pageSize ?? 50, 200);
  const where = {
    orgId: opts.orgId,
    ...(opts.projectId ? { projectId: opts.projectId } : {}),
    ...(opts.action ? { action: opts.action } : {}),
  };
  const [data, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);
  return {
    data: data.map((r) => ({ ...r, meta: r.meta ? JSON.parse(r.meta) : null })),
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  };
}
