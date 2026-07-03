/**
 * @notifyforge/sdk — Official NotifyForge TypeScript SDK
 *
 * Channel-isolated notification infrastructure. Every send call goes to
 * a channel-specific endpoint. The SDK never re-routes, never falls back,
 * never auto-delays. The client explicitly chooses what to send where.
 *
 * @example
 * ```ts
 * import { NotifyForge } from '@notifyforge/sdk';
 *
 * const nf = new NotifyForge({ apiKey: process.env.NOTIFYFORGE_API_KEY! });
 *
 * await nf.push.send({
 *   channel: 'push_android',
 *   target: { externalUserId: 'user-001' },
 *   payload: { title: 'Hello', body: 'World' },
 * });
 *
 * await nf.email.send({
 *   target: { email: 'a@b.com' },
 *   payload: { from: 'noreply@x.com', to: 'a@b.com', subject: 'Hi', html: '<b>Hi</b>' },
 * });
 * ```
 */

export type Channel =
  | 'push_android' | 'push_ios' | 'push_huawei'
  | 'webpush' | 'email' | 'sms' | 'inapp' | 'webhook' | 'desktop';

export type Priority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationStatus = 'queued' | 'processing' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export interface TargetSpec {
  deviceId?: string;
  externalUserId?: string;
  topic?: string;
  email?: string | string[];
  phone?: string | string[];
  url?: string;
  devices?: string[];
  externalUserIds?: string[];
}

export interface SendRequestBase {
  externalId?: string;
  priority?: Priority;
  scheduledAt?: string;
  ttlSeconds?: number;
  collapseKey?: string;
  tags?: string[];
}

export interface PushAndroidPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  notification?: { icon?: string; color?: string; sound?: string; tag?: string; clickAction?: string };
  android?: { priority?: 'normal' | 'high'; collapseKey?: string; ttl?: string; restrictedPackageName?: string; directBootOk?: boolean };
  fcmOptions?: { analyticsLabel?: string };
}

export interface PushIosPayload {
  alert: { title: string; body: string };
  badge?: number;
  sound?: string | { critical: number; name: string; volume: number };
  category?: string;
  'thread-id'?: string;
  'content-available'?: 1;
  'mutable-content'?: 1;
  'interruption-level'?: 'passive' | 'active' | 'time-sensitive' | 'critical';
  'relevance-score'?: number;
  data?: Record<string, unknown>;
  'apns-push-type'?: 'alert' | 'background' | 'location' | 'voip' | 'file' | 'mdm' | 'liveactivity';
  'apns-priority'?: number;
  'apns-topic'?: string;
  'apns-collapse-id'?: string;
}

export interface PushHuaweiPayload {
  message: {
    notification?: { title: string; body: string; icon?: string; color?: string; sound?: string; tag?: string; clickAction?: { type: number; intent?: string; url?: string; action?: string } };
    android?: { collapseKey?: number; urgency?: 'HIGH' | 'NORMAL'; category?: string; ttl?: string; biTag?: string; receiptId?: string };
    data?: string;
    token?: string[];
    topic?: string;
    condition?: string;
  };
}

export interface WebPushPayload {
  title: string; body: string; icon?: string; badge?: string; image?: string;
  data?: Record<string, unknown>;
  actions?: { action: string; title: string; icon?: string }[];
  tag?: string; requireInteraction?: boolean; silent?: boolean; vibrate?: number[];
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

export interface EmailPayload {
  from: string; to: string | string[]; cc?: string | string[]; bcc?: string | string[];
  replyTo?: string; subject: string; html?: string; text?: string;
  templateId?: string; templateData?: Record<string, unknown>;
  attachments?: { filename: string; content: string; contentType?: string }[];
  headers?: Record<string, string>; category?: string;
}

export interface SmsPayload {
  from?: string; to: string | string[]; body: string;
  mediaUrls?: string[]; encoding?: 'auto' | 'gsm7' | 'ucs2';
  validityPeriod?: number; category?: string;
}

export interface InAppPayload {
  userId: string; title: string; body: string;
  category?: string; priority?: Priority;
  data?: Record<string, unknown>;
  actionUrl?: string; imageUrl?: string; expiresAt?: string;
}

export interface WebhookPayload {
  url: string; method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>; body?: unknown;
  signingKey?: string; signingAlgo?: 'hmac-sha256' | 'hmac-sha1';
  retryPolicy?: { maxAttempts: number; backoffMs: number };
}

export interface DesktopPayload {
  title: string; body: string; icon?: string;
  actions?: { action: string; title: string }[];
  data?: Record<string, unknown>;
  urgency?: 'low' | 'normal' | 'critical';
}

export interface ChannelPayloadMap {
  push_android: PushAndroidPayload;
  push_ios: PushIosPayload;
  push_huawei: PushHuaweiPayload;
  webpush: WebPushPayload;
  email: EmailPayload;
  sms: SmsPayload;
  inapp: InAppPayload;
  webhook: WebhookPayload;
  desktop: DesktopPayload;
}

export interface SendRequest<T extends Channel> extends SendRequestBase {
  channel: T;
  target: TargetSpec;
  payload: ChannelPayloadMap[T];
}

export interface SendResponse {
  id: string;
  channel: Channel;
  status: NotificationStatus;
  externalId?: string;
  queuedAt: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; hasNext: boolean };
}

export interface NotifyForgeOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
}

export class NotifyForgeError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'NotifyForgeError';
  }
}

export class NotifyForge {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(opts: NotifyForgeOptions) {
    if (!opts.apiKey) throw new Error('NotifyForge: apiKey is required');
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? 'https://api.notifyforge.dev').replace(/\/$/, '');
    this.fetchImpl = opts.fetch ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.retries = opts.retries ?? 2;
  }

  /** Channel-scoped clients */
  push = new PushClient(this);
  email = new ChannelClient<'email'>(this, 'email');
  sms = new ChannelClient<'sms'>(this, 'sms');
  webpush = new ChannelClient<'webpush'>(this, 'webpush');
  inapp = new ChannelClient<'inapp'>(this, 'inapp');
  webhook = new ChannelClient<'webhook'>(this, 'webhook');
  desktop = new ChannelClient<'desktop'>(this, 'desktop');

  /** Top-level resource clients */
  devices = new DevicesClient(this);
  notifications = new NotificationsClient(this);
  projects = new ProjectsClient(this);
  applications = new ApplicationsClient(this);
  apiKeys = new ApiKeysClient(this);
  templates = new TemplatesClient(this);
  analytics = new AnalyticsClient(this);

  /** Internal request executor — public so advanced users can hit any endpoint. */
  async request<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url.toString(), {
          method,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'notifyforge-typescript/1.0.0',
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.status === 204) return undefined as T;
        const text = await res.text();
        const data = text ? JSON.parse(text) : undefined;

        if (!res.ok) {
          const err = (data as ApiError)?.error;
          throw new NotifyForgeError(
            err?.code ?? 'http_error',
            err?.message ?? `HTTP ${res.status}`,
            res.status,
            err?.details,
          );
        }
        return data as T;
      } catch (e) {
        clearTimeout(timeout);
        lastError = e;
        // Don't retry on 4xx (client errors)
        if (e instanceof NotifyForgeError && e.status >= 400 && e.status < 500) throw e;
        // Retry on network/5xx with exponential backoff
        if (attempt < this.retries) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
          continue;
        }
      }
    }
    throw lastError;
  }
}

class ChannelClient<T extends Channel> {
  constructor(private client: NotifyForge, private channel: T) {}
  send(req: Omit<SendRequest<T>, 'channel'>): Promise<SendResponse> {
    return this.client.request<SendResponse>('POST', `/api/v1/${this.channel === 'push_android' || this.channel === 'push_ios' || this.channel === 'push_huawei' ? 'push' : this.channel}/send`, { channel: this.channel, ...req });
  }
}

class PushClient {
  constructor(private client: NotifyForge) {}
  send(req: SendRequest<'push_android' | 'push_ios' | 'push_huawei'>): Promise<SendResponse> {
    return this.client.request<SendResponse>('POST', '/api/v1/push/send', req);
  }
}

class DevicesClient {
  constructor(private client: NotifyForge) {}
  register(body: {
    applicationId?: string;
    channel: 'push_android' | 'push_ios' | 'push_huawei' | 'webpush' | 'desktop' | 'inapp';
    token: string;
    externalUserId?: string;
    platform?: string;
    appVersion?: string;
    language?: string;
    timezone?: string;
    tags?: string[];
    attributes?: Record<string, unknown>;
  }): Promise<{ id: string; channel: string; tokenStatus: string; createdAt: string }> {
    return this.client.request('POST', '/api/v1/devices/register', body);
  }
  list(params: { channel?: string; status?: string; externalUserId?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<unknown>> {
    return this.client.request('GET', '/api/v1/devices', undefined, params as Record<string, string>);
  }
  get(id: string): Promise<unknown> {
    return this.client.request('GET', `/api/v1/devices/${id}`);
  }
  invalidate(id: string): Promise<{ id: string; tokenStatus: string }> {
    return this.client.request('DELETE', `/api/v1/devices/${id}`);
  }
}

class NotificationsClient {
  constructor(private client: NotifyForge) {}
  list(params: { channel?: string; status?: string; externalId?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<unknown>> {
    return this.client.request('GET', '/api/v1/notifications', undefined, params as Record<string, string>);
  }
  get(id: string): Promise<unknown> {
    return this.client.request('GET', `/api/v1/notifications/${id}`);
  }
  cancel(id: string): Promise<{ id: string; status: 'cancelled' }> {
    return this.client.request('POST', `/api/v1/notifications/${id}/cancel`);
  }
}

class ProjectsClient {
  constructor(private client: NotifyForge) {}
  list(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<unknown>> {
    return this.client.request('GET', '/api/v1/projects', undefined, params as Record<string, string>);
  }
  create(body: { name: string; slug?: string; description?: string }): Promise<unknown> {
    return this.client.request('POST', '/api/v1/projects', body);
  }
}

class ApplicationsClient {
  constructor(private client: NotifyForge) {}
  list(params: { projectId?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<unknown>> {
    return this.client.request('GET', '/api/v1/applications', undefined, params as Record<string, string>);
  }
  create(body: { projectId: string; name: string; slug?: string; platform: string; description?: string }): Promise<unknown> {
    return this.client.request('POST', '/api/v1/applications', body);
  }
}

class ApiKeysClient {
  constructor(private client: NotifyForge) {}
  list(params: { projectId?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<unknown>> {
    return this.client.request('GET', '/api/v1/api-keys', undefined, params as Record<string, string>);
  }
  create(body: { projectId: string; applicationId?: string; name: string; scopes?: string[]; rateLimit?: number; expiresAt?: string }): Promise<{ id: string; key: string; keyPrefix: string; name: string }> {
    return this.client.request('POST', '/api/v1/api-keys', body);
  }
}

class TemplatesClient {
  constructor(private client: NotifyForge) {}
  list(params: { projectId?: string; channel?: string; page?: number; pageSize?: number } = {}): Promise<Paginated<unknown>> {
    return this.client.request('GET', '/api/v1/templates', undefined, params as Record<string, string>);
  }
  create(body: { projectId: string; channel: string; name: string; slug?: string; subject?: string; body: string; variables?: Record<string, unknown> }): Promise<unknown> {
    return this.client.request('POST', '/api/v1/templates', body);
  }
}

class AnalyticsClient {
  constructor(private client: NotifyForge) {}
  summary(params: { projectId?: string; from?: string; to?: string } = {}): Promise<unknown> {
    return this.client.request('GET', '/api/v1/analytics/summary', undefined, params as Record<string, string>);
  }
}

export default NotifyForge;
