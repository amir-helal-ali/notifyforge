/**
 * API helpers — consistent JSON responses, error handling, pagination.
 */

import type { ApiError, Paginated } from '@/lib/types';

export function ok<T>(data: T, status: number = 200): Response {
  return Response.json(data, { status });
}

export function created<T>(data: T): Response {
  return Response.json(data, { status: 201 });
}

export function apiError(code: string, message: string, status: number = 400, details?: Record<string, unknown>): Response {
  const body: ApiError = { error: { code, message, ...(details ? { details } : {}) } };
  return Response.json(body, { status });
}

export function notFound(message = 'Resource not found'): Response {
  return apiError('not_found', message, 404);
}

export function conflict(message: string): Response {
  return apiError('conflict', message, 409);
}

export function rateLimited(resetAt: Date): Response {
  return apiError(
    'rate_limited',
    `Rate limit exceeded. Resets at ${resetAt.toISOString()}.`,
    429,
    { resetAt: resetAt.toISOString() },
  );
}

export function validationError(field: string, message: string): Response {
  return apiError('validation_error', message, 422, { field });
}

export async function parseJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function paginate<T>(data: T[], page: number, pageSize: number, total: number): Paginated<T> {
  return {
    data,
    pagination: { page, pageSize, total, hasNext: page * pageSize < total },
  };
}

export function getPagination(req: Request): { page: number; pageSize: number } {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '50', 10)));
  return { page, pageSize };
}

export function clientIp(req: Request): string | undefined {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  const real = req.headers.get('x-real-ip');
  return real ?? undefined;
}

export function userAgent(req: Request): string | undefined {
  return req.headers.get('user-agent') ?? undefined;
}
