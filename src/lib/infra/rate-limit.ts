/**
 * Token-bucket rate limiter.
 *
 * Bucket key = `apikey:{id}:{windowMs}:{floor(now/windowMs)}`.
 * On each request we atomically increment the bucket counter and reject
 * if it exceeds the limit. Buckets auto-expire via the expiresAt index.
 *
 * In production this would run on Redis (INCR + EXPIRE) for sub-ms latency
 * and cross-process consistency. The SQLite implementation here preserves
 * the same semantics for single-node deployments.
 */

import { db } from '@/lib/db';

const WINDOW_MS = 60_000; // 1 minute

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
}

export async function consumeRateLimit(
  bucketOwner: string,
  limit: number,
  windowMs: number = WINDOW_MS,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEnd = windowStart + windowMs;
  const bucketKey = `${bucketOwner}:${windowMs}:${windowStart}`;

  // Lookup or create bucket
  const existing = await db.rateLimitBucket.findUnique({ where: { bucketKey } });
  let tokens: number;
  if (existing) {
    if (existing.tokens >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt: new Date(windowEnd),
      };
    }
    const updated = await db.rateLimitBucket.update({
      where: { bucketKey },
      data: { tokens: { increment: 1 } },
    });
    tokens = updated.tokens;
  } else {
    try {
      const created = await db.rateLimitBucket.create({
        data: {
          bucketKey,
          tokens: 1,
          limit,
          windowMs,
          expiresAt: new Date(windowEnd + 1000),
        },
      });
      tokens = created.tokens;
    } catch {
      // Race condition — re-read and increment
      const updated = await db.rateLimitBucket.update({
        where: { bucketKey },
        data: { tokens: { increment: 1 } },
      });
      tokens = updated.tokens;
    }
  }

  return {
    allowed: tokens <= limit,
    limit,
    remaining: Math.max(0, limit - tokens),
    resetAt: new Date(windowEnd),
  };
}

export async function cleanupExpiredBuckets(): Promise<number> {
  const now = new Date();
  const result = await db.rateLimitBucket.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return result.count;
}
