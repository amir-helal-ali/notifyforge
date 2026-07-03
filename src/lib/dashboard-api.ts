/**
 * Dashboard API client — typed fetch helpers for the in-app dashboard.
 * All routes are relative paths so Caddy can route them.
 */

export interface OverviewData {
  counts: {
    projects: number;
    apps: number;
    apiKeys: number;
    devices: number;
    notifications: number;
    templates: number;
    last24h: number;
  };
  byChannel: { channel: string; count: number }[];
  byStatus: { status: string; count: number }[];
  series: Record<string, { bucket: string; count: number }[]>;
}

export interface NotificationRow {
  id: string;
  channel: string;
  status: string;
  priority: string;
  externalId: string | null;
  provider: string | null;
  providerMessageId: string | null;
  attemptCount: number;
  maxAttempts: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  failedAt: string | null;
  project: { id: string; name: string } | null;
  application: { id: string; name: string } | null;
}

export interface ChannelInfo {
  id: string;
  name: string;
  provider: string;
  endpoint: string;
  scope: string;
  totalSent: number;
}

export interface DeviceRow {
  id: string;
  channel: string;
  token: string;
  tokenStatus: string;
  externalUserId: string | null;
  platform: string | null;
  appVersion: string | null;
  language: string | null;
  tags: string[];
  lastSeenAt: string | null;
  invalidatedAt: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
  application: { id: string; name: string } | null;
}

export interface ProjectRow {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count: { applications: number; devices: number; notifications: number; apiKeys: number };
}

export interface AppRow {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  platform: string;
  description: string | null;
  createdAt: string;
  project: { id: string; name: string };
  _count: { devices: number; notifications: number };
}

export interface ApiKeyRow {
  id: string;
  keyPrefix: string;
  name: string;
  scopes: string[];
  rateLimit: number;
  status: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  project: { id: string; name: string } | null;
  application: { id: string; name: string } | null;
}

export interface TemplateRow {
  id: string;
  projectId: string;
  channel: string;
  name: string;
  slug: string;
  subject: string | null;
  body: string;
  variables: Record<string, unknown> | null;
  version: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRow {
  id: string;
  orgId: string;
  userId: string | null;
  projectId: string | null;
  action: string;
  resource: string | null;
  ip: string | null;
  userAgent: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; email: string } | null;
  project: { id: string; name: string } | null;
}

export interface AnalyticsData {
  range: string;
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  deliveryRate: number;
  latencyMs: { p50: number; p90: number; p99: number; avg: number };
  channels: Record<string, { total: number; delivered: number; failed: number; pending: number; deliveryRate: number }>;
  series: { bucket: string; total: number; delivered: number; failed: number }[];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
  return data as T;
}

async function deleteJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const dashboardApi = {
  overview: () => getJson<OverviewData>('/api/dashboard/overview'),
  channels: () => getJson<ChannelInfo[]>('/api/dashboard/channels'),
  notifications: (params: { channel?: string; status?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.channel) q.set('channel', params.channel);
    if (params.status) q.set('status', params.status);
    q.set('page', String(params.page ?? 1));
    q.set('pageSize', String(params.pageSize ?? 25));
    return getJson<{ data: NotificationRow[]; pagination: { page: number; pageSize: number; total: number; hasNext: boolean } }>(`/api/dashboard/notifications?${q}`);
  },
  devices: (params: { channel?: string; status?: string; externalUserId?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.channel) q.set('channel', params.channel);
    if (params.status) q.set('status', params.status);
    if (params.externalUserId) q.set('externalUserId', params.externalUserId);
    q.set('page', String(params.page ?? 1));
    q.set('pageSize', String(params.pageSize ?? 25));
    return getJson<{ data: DeviceRow[]; pagination: { page: number; pageSize: number; total: number; hasNext: boolean } }>(`/api/dashboard/devices?${q}`);
  },
  projects: (params: { page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    q.set('page', String(params.page ?? 1));
    q.set('pageSize', String(params.pageSize ?? 25));
    return getJson<{ data: ProjectRow[]; pagination: { page: number; pageSize: number; total: number; hasNext: boolean } }>(`/api/dashboard/projects?${q}`);
  },
  createProject: (body: { name: string; slug?: string; description?: string }) =>
    postJson<ProjectRow>('/api/dashboard/projects', body),
  apps: (params: { projectId?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.projectId) q.set('projectId', params.projectId);
    q.set('page', String(params.page ?? 1));
    q.set('pageSize', String(params.pageSize ?? 25));
    return getJson<{ data: AppRow[]; pagination: { page: number; pageSize: number; total: number; hasNext: boolean } }>(`/api/dashboard/apps?${q}`);
  },
  createApp: (body: { projectId: string; name: string; slug?: string; platform: string; description?: string }) =>
    postJson<AppRow>('/api/dashboard/apps', body),
  apiKeys: (params: { projectId?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.projectId) q.set('projectId', params.projectId);
    q.set('page', String(params.page ?? 1));
    q.set('pageSize', String(params.pageSize ?? 25));
    return getJson<{ data: ApiKeyRow[]; pagination: { page: number; pageSize: number; total: number; hasNext: boolean } }>(`/api/dashboard/api-keys?${q}`);
  },
  createApiKey: (body: { projectId: string; applicationId?: string; name: string; scopes?: string[]; rateLimit?: number; expiresAt?: string }) =>
    postJson<ApiKeyRow & { key: string }>('/api/dashboard/api-keys', body),
  revokeApiKey: (id: string) => deleteJson<{ id: string; status: string }>(`/api/dashboard/api-keys?id=${id}`),
  templates: (params: { projectId?: string; channel?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.projectId) q.set('projectId', params.projectId);
    if (params.channel) q.set('channel', params.channel);
    q.set('page', String(params.page ?? 1));
    q.set('pageSize', String(params.pageSize ?? 25));
    return getJson<{ data: TemplateRow[]; pagination: { page: number; pageSize: number; total: number; hasNext: boolean } }>(`/api/dashboard/templates?${q}`);
  },
  createTemplate: (body: { projectId: string; channel: string; name: string; slug?: string; subject?: string; body: string; variables?: Record<string, unknown>; description?: string }) =>
    postJson<TemplateRow>('/api/dashboard/templates', body),
  analytics: (range: '24h' | '7d' = '24h') => getJson<AnalyticsData>(`/api/dashboard/analytics?range=${range}`),
  audit: (params: { projectId?: string; action?: string; page?: number; pageSize?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.projectId) q.set('projectId', params.projectId);
    if (params.action) q.set('action', params.action);
    q.set('page', String(params.page ?? 1));
    q.set('pageSize', String(params.pageSize ?? 25));
    return getJson<{ data: AuditRow[]; pagination: { page: number; pageSize: number; total: number; hasNext: boolean } }>(`/api/dashboard/audit?${q}`);
  },
  sendTest: (body: { channel: string; target: unknown; payload: unknown; priority?: string }) =>
    postJson<{ id: string; channel: string; status: string; queuedAt: string }>('/api/dashboard/send-test', body),
  masterKey: () => getJson<{ fullKey: string; keyPrefix: string; orgId: string; projectId: string; applicationId: string }>('/api/dashboard/master-key'),
};
