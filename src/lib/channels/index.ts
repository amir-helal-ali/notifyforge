/**
 * Channel engine registry — wires all engines and registers their workers.
 * Imported once at server startup.
 */

import { registerChannelEngine } from '@/lib/channels/registry';
import { registerChannelWorker } from '@/lib/infra/queue';
import { fcmEngine } from '@/lib/channels/push-android';
import { apnsEngine } from '@/lib/channels/push-ios';
import { huaweiEngine } from '@/lib/channels/push-huawei';
import { webPushEngine } from '@/lib/channels/webpush';
import { emailEngine } from '@/lib/channels/email';
import { smsEngine } from '@/lib/channels/sms';
import { inAppEngine } from '@/lib/channels/inapp';
import { webhookEngine } from '@/lib/channels/webhook';
import { desktopEngine } from '@/lib/channels/desktop';
import { processNotificationJob } from '@/lib/channels/worker';

let initialized = false;

export function initChannels(): void {
  if (initialized) return;
  initialized = true;

  registerChannelEngine(fcmEngine);
  registerChannelEngine(apnsEngine);
  registerChannelEngine(huaweiEngine);
  registerChannelEngine(webPushEngine);
  registerChannelEngine(emailEngine);
  registerChannelEngine(smsEngine);
  registerChannelEngine(inAppEngine);
  registerChannelEngine(webhookEngine);
  registerChannelEngine(desktopEngine);

  // Wire all channels to the same processor (which dispatches via registry)
  const channels = [
    'push_android',
    'push_ios',
    'push_huawei',
    'webpush',
    'email',
    'sms',
    'inapp',
    'webhook',
    'desktop',
  ] as const;
  for (const channel of channels) {
    registerChannelWorker(channel, (job) => processNotificationJob(job));
  }
}
