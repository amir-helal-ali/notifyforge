/**
 * NotifyForge — Core types shared across channels and services.
 * Channel isolation is enforced at the type level: every Notification
 * is bound to exactly one Channel and uses a Channel-specific payload.
 */

export type Channel =
  | 'push_android'
  | 'push_ios'
  | 'push_huawei'
  | 'webpush'
  | 'email'
  | 'sms'
  | 'inapp'
  | 'webhook'
  | 'desktop';

export type NotificationStatus =
  | 'queued'
  | 'processing'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type Priority = 'low' | 'normal' | 'high' | 'critical';

export interface AuthContext {
  orgId: string;
  projectId: string | null;
  applicationId: string | null;
  apiKeyId: string;
  scopes: string[];
  rateLimit: number;
}

export interface TargetSpec {
  // Exactly one of these must be set per channel
  deviceId?: string;
  externalUserId?: string;
  topic?: string;
  email?: string;
  phone?: string;
  url?: string;
  devices?: string[]; // batch
  externalUserIds?: string[]; // batch
}

export interface SendRequestBase {
  externalId?: string;
  priority?: Priority;
  scheduledAt?: string;
  ttlSeconds?: number;
  collapseKey?: string;
  tags?: string[];
  template?: { slug: string; variables?: Record<string, unknown> };
}

export interface PushAndroidPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  notification?: {
    icon?: string;
    color?: string;
    sound?: string;
    tag?: string;
    clickAction?: string;
  };
  android?: {
    priority?: 'normal' | 'high';
    collapseKey?: string;
    ttl?: string; // e.g. "60s"
    restrictedPackageName?: string;
    directBootOk?: boolean;
  };
  fcmOptions?: {
    analyticsLabel?: string;
  };
}

export interface PushIosPayload {
  alert: { title: string; body: string };
  badge?: number;
  sound?: string | { critical: number; name: string; volume: number };
  category?: string;
  'thread-id'?: string;
  'content-available'?: 1; // silent push
  'mutable-content'?: 1; // mutable content
  'interruption-level'?: 'passive' | 'active' | 'time-sensitive' | 'critical';
  'relevance-score'?: number;
  data?: Record<string, unknown>;
  // Live Activities
  'apns-push-type'?: 'alert' | 'background' | 'location' | 'voip' | 'file' | 'mdm' | 'liveactivity';
  'apns-priority'?: number; // 5 or 10
  'apns-topic'?: string;
  'apns-collapse-id'?: string;
}

export interface PushHuaweiPayload {
  // HMS Push Kit message
  message: {
    notification?: {
      title: string;
      body: string;
      icon?: string;
      color?: string;
      sound?: string;
      tag?: string;
      clickAction?: { type: number; intent?: string; url?: string; action?: string };
    };
    android?: {
      collapseKey?: number;
      urgency?: 'HIGH' | 'NORMAL';
      category?: string;
      ttl?: string;
      biTag?: string;
      receiptId?: string;
    };
    data?: string;
    token?: string[];
    topic?: string;
    condition?: string;
  };
}

export interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  data?: Record<string, unknown>;
  actions?: { action: string; title: string; icon?: string }[];
  tag?: string;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

export interface EmailPayload {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  templateData?: Record<string, unknown>;
  attachments?: { filename: string; content: string; contentType?: string }[];
  headers?: Record<string, string>;
  category?: string;
}

export interface SmsPayload {
  from?: string;
  to: string | string[];
  body: string;
  mediaUrls?: string[];
  encoding?: 'auto' | 'gsm7' | 'ucs2';
  validityPeriod?: number;
  category?: string;
}

export interface InAppPayload {
  userId: string;
  title: string;
  body: string;
  category?: string;
  priority?: Priority;
  data?: Record<string, unknown>;
  actionUrl?: string;
  imageUrl?: string;
  expiresAt?: string;
}

export interface WebhookPayload {
  url: string;
  method?: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  signingKey?: string;
  signingAlgo?: 'hmac-sha256' | 'hmac-sha1';
  retryPolicy?: { maxAttempts: number; backoffMs: number };
}

export interface DesktopPayload {
  title: string;
  body: string;
  icon?: string;
  actions?: { action: string; title: string }[];
  data?: Record<string, unknown>;
  urgency?: 'low' | 'normal' | 'critical';
}

export type ChannelPayloadMap = {
  push_android: PushAndroidPayload;
  push_ios: PushIosPayload;
  push_huawei: PushHuaweiPayload;
  webpush: WebPushPayload;
  email: EmailPayload;
  sms: SmsPayload;
  inapp: InAppPayload;
  webhook: WebhookPayload;
  desktop: DesktopPayload;
};

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
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasNext: boolean;
  };
}
