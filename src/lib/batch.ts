/**
 * Batch ingest — processes an array of send requests in a single API call.
 * Each item is validated and enqueued independently; one bad item does not
 * reject the whole batch.
 *
 * Returns per-item results so callers can see which succeeded and which failed.
 */

import { db } from '@/lib/db';
import { enqueue } from '@/lib/infra/queue';
import { getChannelEngine } from '@/lib/channels/registry';
import { writeAudit } from '@/lib/infra/audit';
import { logger } from '@/lib/infra/logger';
import type { AuthContext, Channel, SendRequest, SendResponse } from '@/lib/types';

export interface BatchItemResult {
  index: number;
  ok: boolean;
  id?: string;
  externalId?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface BatchResponse {
  accepted: number;
  rejected: number;
  results: BatchItemResult[];
}

export async function ingestBatch(
  ctx: AuthContext,
  items: SendRequest<Channel>[],
): Promise<BatchResponse> {
  if (!ctx.projectId) {
    return {
      accepted: 0,
      rejected: items.length,
      results: items.map((_, i) => ({
        index: i,
        ok: false,
        errorCode: 'no_project',
        errorMessage: 'API key is not bound to a project',
      })),
    };
  }

  if (items.length > 1000) {
    return {
      accepted: 0,
      rejected: items.length,
      results: [{
        index: 0,
        ok: false,
        errorCode: 'batch_too_large',
        errorMessage: 'Batch size cannot exceed 1000 items per request',
      }],
    };
  }

  const results: BatchItemResult[] = [];
  let accepted = 0;
  let rejected = 0;

  // Process items in parallel chunks for efficiency
  const chunkSize = 20;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(
      chunk.map(async (item, j) => {
        const index = i + j;
        try {
          const engine = getChannelEngine(item.channel);
          if (!engine) {
            return {
              index,
              ok: false,
              errorCode: 'invalid_channel',
              errorMessage: `Channel ${item.channel} not supported`,
            } satisfies BatchItemResult;
          }

          const targetOk = engine.validateTarget(item.target);
          if (!targetOk.valid) {
            return {
              index,
              ok: false,
              errorCode: 'validation_error',
              errorMessage: targetOk.error!,
            } satisfies BatchItemResult;
          }
          const payloadOk = engine.validatePayload(item.payload);
          if (!payloadOk.valid) {
            return {
              index,
              ok: false,
              errorCode: 'validation_error',
              errorMessage: payloadOk.error!,
            } satisfies BatchItemResult;
          }

          // Idempotency check
          if (item.externalId) {
            const existing = await db.notification.findFirst({
              where: { projectId: ctx.projectId!, externalId: item.externalId },
            });
            if (existing) {
              return {
                index,
                ok: true,
                id: existing.id,
                externalId: existing.externalId ?? undefined,
                status: existing.status,
              } satisfies BatchItemResult;
            }
          }

          const notification = await db.notification.create({
            data: {
              orgId: ctx.orgId,
              projectId: ctx.projectId!,
              applicationId: ctx.applicationId,
              apiKeyId: ctx.apiKeyId,
              channel: item.channel,
              externalId: item.externalId,
              status: 'queued',
              priority: item.priority ?? 'normal',
              payload: JSON.stringify(item.payload),
              target: JSON.stringify(item.target),
              ttlSeconds: item.ttlSeconds ?? null,
              collapseKey: item.collapseKey ?? null,
              tags: item.tags ? JSON.stringify(item.tags) : null,
              scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : null,
              maxAttempts: 3,
            },
          });

          await db.notificationEvent.create({
            data: { notificationId: notification.id, type: 'created' },
          });

          const scheduledFor = item.scheduledAt ? new Date(item.scheduledAt).getTime() : Date.now();
          enqueue({
            notificationId: notification.id,
            channel: item.channel,
            attempt: 1,
            scheduledFor,
          });

          return {
            index,
            ok: true,
            id: notification.id,
            externalId: item.externalId,
            status: 'queued',
          } satisfies BatchItemResult;
        } catch (e) {
          return {
            index,
            ok: false,
            errorCode: 'internal_error',
            errorMessage: (e as Error).message,
          } satisfies BatchItemResult;
        }
      }),
    );
    for (const r of chunkResults) {
      results.push(r);
      if (r.ok) accepted++;
      else rejected++;
    }
  }

  await writeAudit({
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    action: 'notification.batch',
    meta: { items: items.length, accepted, rejected },
  });

  logger.info('batch.ingested', {
    orgId: ctx.orgId,
    projectId: ctx.projectId,
    total: items.length,
    accepted,
    rejected,
  });

  return { accepted, rejected, results };
}
