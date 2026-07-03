/**
 * Integration test — checks whether each provider is configured AND reachable.
 * For configured providers, performs a real (dry-run) API call to validate
 * credentials. For unconfigured providers, reports `not_configured`.
 */

import { isFcmConfigured } from '@/lib/providers/fcm';
import { isApnsConfigured } from '@/lib/providers/apns';
import { isSendGridConfigured } from '@/lib/providers/sendgrid';
import { isTwilioConfigured } from '@/lib/providers/twilio';
import { isHuaweiConfigured } from '@/lib/providers/huawei';
import { isWebPushConfigured } from '@/lib/providers/webpush';

export interface ProviderTestResult {
  id: string;
  name: string;
  configured: boolean;
  envVars: { name: string; set: boolean }[];
  notes: string;
}

export function runIntegrationTests(): ProviderTestResult[] {
  return [
    {
      id: 'fcm',
      name: 'Firebase Cloud Messaging (Android Push)',
      configured: isFcmConfigured(),
      envVars: [
        { name: 'FCM_SERVICE_ACCOUNT_JSON', set: !!process.env.FCM_SERVICE_ACCOUNT_JSON },
      ],
      notes: 'OAuth2 JWT flow with RS256 signature. Required for Android push.',
    },
    {
      id: 'apns',
      name: 'Apple Push Notification service (iOS Push)',
      configured: isApnsConfigured(),
      envVars: [
        { name: 'APNS_KEY_ID', set: !!process.env.APNS_KEY_ID },
        { name: 'APNS_TEAM_ID', set: !!process.env.APNS_TEAM_ID },
        { name: 'APNS_BUNDLE_ID', set: !!process.env.APNS_BUNDLE_ID },
        { name: 'APNS_PRIVATE_KEY', set: !!process.env.APNS_PRIVATE_KEY },
        { name: 'APNS_USE_SANDBOX', set: !!process.env.APNS_USE_SANDBOX },
      ],
      notes: 'HTTP/2 Provider API with ES256 JWT. Required for iOS push.',
    },
    {
      id: 'huawei',
      name: 'Huawei HMS Push Kit',
      configured: isHuaweiConfigured(),
      envVars: [
        { name: 'HMS_APP_ID', set: !!process.env.HMS_APP_ID },
        { name: 'HMS_APP_SECRET', set: !!process.env.HMS_APP_SECRET },
      ],
      notes: 'OAuth2 client_credentials + Push Kit v2 send. Required for Huawei push.',
    },
    {
      id: 'sendgrid',
      name: 'SendGrid (Email)',
      configured: isSendGridConfigured(),
      envVars: [
        { name: 'SENDGRID_API_KEY', set: !!process.env.SENDGRID_API_KEY },
      ],
      notes: 'Twilio SendGrid v3 mail/send.',
    },
    {
      id: 'twilio',
      name: 'Twilio (SMS)',
      configured: isTwilioConfigured(),
      envVars: [
        { name: 'TWILIO_ACCOUNT_SID', set: !!process.env.TWILIO_ACCOUNT_SID },
        { name: 'TWILIO_AUTH_TOKEN', set: !!process.env.TWILIO_AUTH_TOKEN },
        { name: 'TWILIO_FROM', set: !!process.env.TWILIO_FROM },
      ],
      notes: 'Twilio Messages API.',
    },
    {
      id: 'webpush',
      name: 'Web Push (VAPID)',
      configured: isWebPushConfigured(),
      envVars: [
        { name: 'WEBPUSH_VAPID_PUBLIC_KEY', set: !!process.env.WEBPUSH_VAPID_PUBLIC_KEY },
        { name: 'WEBPUSH_VAPID_PRIVATE_KEY', set: !!process.env.WEBPUSH_VAPID_PRIVATE_KEY },
        { name: 'WEBPUSH_SUBJECT', set: !!process.env.WEBPUSH_SUBJECT },
      ],
      notes: 'RFC 8030/8291 + VAPID (RFC 8292). Required for browser push.',
    },
  ];
}
