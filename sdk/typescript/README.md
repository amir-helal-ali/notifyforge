# @notifyforge/sdk

Official **NotifyForge** TypeScript SDK — strongly-typed notification infrastructure client.

## Install

```bash
npm install @notifyforge/sdk
# or
yarn add @notifyforge/sdk
# or
bun add @notifyforge/sdk
```

## Quickstart

```ts
import { NotifyForge } from '@notifyforge/sdk';

const nf = new NotifyForge({ apiKey: process.env.NOTIFYFORGE_API_KEY! });

// 1. Register a device (mobile SDKs do this automatically)
await nf.devices.register({
  channel: 'push_android',
  token: fcmToken,
  externalUserId: 'user-001',
  platform: 'android',
  appVersion: '1.4.2',
});

// 2. Send an Android push — explicit channel, never re-routed
const { id } = await nf.push.send({
  channel: 'push_android',
  target: { externalUserId: 'user-001' },
  payload: {
    title: 'Order shipped',
    body: 'Your order #12345 is on the way.',
    data: { orderId: '12345' },
    android: { priority: 'high', collapseKey: 'order-status', ttl: '60s' },
  },
});

// 3. Send an email — also explicit
await nf.email.send({
  target: { email: 'customer@example.com' },
  payload: {
    from: 'notifications@notifyforge.dev',
    to: 'customer@example.com',
    subject: 'Receipt #12345',
    html: '<h1>Thanks!</h1>',
  },
});

// 4. iOS push with full APNs feature set
await nf.push.send({
  channel: 'push_ios',
  target: { externalUserId: 'user-001' },
  payload: {
    alert: { title: 'New message', body: 'Sarah sent a photo' },
    badge: 3,
    sound: 'default',
    category: 'MESSAGE_CATEGORY',
    'mutable-content': 1,         // Notification Service Extension
    'interruption-level': 'time-sensitive',
    'apns-push-type': 'alert',
    'apns-priority': 10,
    'apns-topic': 'com.example.app',
    data: { threadId: 'msg-sarah' },
  },
});

// 5. Webhook with HMAC-SHA256 signature
await nf.webhook.send({
  target: {},
  payload: {
    url: 'https://api.example.com/hooks/notifyforge',
    method: 'POST',
    body: { event: 'order.created', orderId: '12345' },
    signingKey: process.env.WEBHOOK_SIGNING_SECRET!,
    signingAlgo: 'hmac-sha256',
  },
});
```

## Channel clients

Each channel has a dedicated, strongly-typed client:

| Client        | Endpoint                    | Scope           |
| ------------- | --------------------------- | --------------- |
| `nf.push`     | `/api/v1/push/send`         | `push:send`     |
| `nf.email`    | `/api/v1/email/send`        | `email:send`    |
| `nf.sms`      | `/api/v1/sms/send`          | `sms:send`      |
| `nf.webpush`  | `/api/v1/webpush/send`      | `webpush:send`  |
| `nf.inapp`    | `/api/v1/inapp/send`        | `inapp:send`    |
| `nf.webhook`  | `/api/v1/webhook/send`      | `webhook:send`  |
| `nf.desktop`  | `/api/v1/desktop/send`      | `desktop:send`  |

The push client supports `push_android`, `push_ios`, and `push_huawei` via the `channel` field.

## Resource clients

| Client            | Description                                  |
| ----------------- | -------------------------------------------- |
| `nf.devices`      | Register, list, invalidate device tokens     |
| `nf.notifications`| List, fetch, cancel notifications            |
| `nf.projects`     | Create and list projects                     |
| `nf.applications` | Create and list applications                 |
| `nf.apiKeys`      | Create and list API keys                     |
| `nf.templates`    | Create and list templates                    |
| `nf.analytics`    | Fetch delivery analytics                     |

## Error handling

```ts
import { NotifyForge, NotifyForgeError } from '@notifyforge/sdk';

try {
  await nf.push.send({ ... });
} catch (e) {
  if (e instanceof NotifyForgeError) {
    console.error(e.code, e.status, e.message, e.details);
  }
}
```

## Retries

The SDK retries on network errors and 5xx responses with exponential backoff
(500ms, 1s, 2s, …). 4xx errors are not retried. Configure via `retries` option.

## License

MIT
