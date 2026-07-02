/**
 * Provider health registry — tracks the operational state of each upstream provider.
 * In production this is populated by:
 *   - Periodic synthetic sends (canary checks)
 *   - Provider API health endpoints
 *   - Error rate thresholds (mark degraded when >5% over 1 min)
 */

export type ProviderStatus = 'operational' | 'degraded' | 'down' | 'unknown';

export interface ProviderHealth {
  id: string;
  channel: string;
  provider: string;
  name: string;
  status: ProviderStatus;
  latencyMs: number | null;
  lastCheckedAt: string;
  lastIncidentAt: string | null;
  uptimePercent: number;
  errorRate: number;
  description: string;
}

// Static health snapshot — in production this comes from Prometheus queries.
export function getProviderHealthSnapshot(): ProviderHealth[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'fcm',
      channel: 'push_android',
      provider: 'fcm',
      name: 'Firebase Cloud Messaging',
      status: 'operational',
      latencyMs: 142,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.98,
      errorRate: 0.2,
      description: 'Google FCM HTTP v1 API',
    },
    {
      id: 'apns',
      channel: 'push_ios',
      provider: 'apns',
      name: 'Apple Push Notification service',
      status: 'operational',
      latencyMs: 89,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.95,
      errorRate: 0.5,
      description: 'APNs HTTP/2 Provider API',
    },
    {
      id: 'huawei',
      channel: 'push_huawei',
      provider: 'huawei',
      name: 'Huawei Push Kit',
      status: 'operational',
      latencyMs: 210,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.90,
      errorRate: 1.0,
      description: 'HMS Push Kit v2',
    },
    {
      id: 'webpush',
      channel: 'webpush',
      provider: 'webpush',
      name: 'Web Push (VAPID)',
      status: 'operational',
      latencyMs: 65,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.99,
      errorRate: 0.1,
      description: 'RFC 8030 / 8291',
    },
    {
      id: 'sendgrid',
      channel: 'email',
      provider: 'sendgrid',
      name: 'SendGrid',
      status: 'degraded',
      latencyMs: 1850,
      lastCheckedAt: now,
      lastIncidentAt: now,
      uptimePercent: 99.50,
      errorRate: 4.2,
      description: 'Twilio SendGrid v3 API — elevated latency detected',
    },
    {
      id: 'ses',
      channel: 'email',
      provider: 'ses',
      name: 'Amazon SES',
      status: 'operational',
      latencyMs: 320,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.97,
      errorRate: 0.3,
      description: 'AWS Simple Email Service',
    },
    {
      id: 'twilio',
      channel: 'sms',
      provider: 'twilio',
      name: 'Twilio',
      status: 'operational',
      latencyMs: 410,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.92,
      errorRate: 0.8,
      description: 'Twilio Messages API',
    },
    {
      id: 'vonage',
      channel: 'sms',
      provider: 'vonage',
      name: 'Vonage',
      status: 'operational',
      latencyMs: 380,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.88,
      errorRate: 1.2,
      description: 'Vonage SMS API',
    },
    {
      id: 'inapp',
      channel: 'inapp',
      provider: 'inapp',
      name: 'In-App (WebSocket)',
      status: 'operational',
      latencyMs: 12,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.99,
      errorRate: 0.0,
      description: 'NotifyForge Real-time Service',
    },
    {
      id: 'webhook',
      channel: 'webhook',
      provider: 'http',
      name: 'Webhook (HTTP)',
      status: 'operational',
      latencyMs: null,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.95,
      errorRate: 0.5,
      description: 'Per-customer HTTP delivery',
    },
    {
      id: 'desktop',
      channel: 'desktop',
      provider: 'desktop',
      name: 'Desktop (Polling)',
      status: 'operational',
      latencyMs: 15,
      lastCheckedAt: now,
      lastIncidentAt: null,
      uptimePercent: 99.99,
      errorRate: 0.0,
      description: 'NotifyForge Desktop SDK',
    },
  ];
}
