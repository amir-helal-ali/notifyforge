'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, KeyRound, BookOpen, Code2, Boxes } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function SdkDocsSection() {
  const [masterKey, setMasterKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch('/api/dashboard/master-key')
      .then((r) => r.json())
      .then((d) => setMasterKey(d.fullKey ?? null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SDK & Documentation</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Strongly-typed SDKs for every major platform. The TypeScript SDK is shown below;
          Rust, Go, Python, Java, Kotlin, Swift, C#, PHP, Flutter, React Native, and Unity follow the same shape.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> Your master API key</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-xs break-all">
                {masterKey ?? 'not available'}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (masterKey) {
                    navigator.clipboard.writeText(masterKey);
                    toast({ title: 'Copied' });
                  }
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            This key has all scopes. Use it for local development only — create scoped keys from the API Keys tab for production.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Code2 className="h-4 w-4" /> TypeScript SDK — install</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">{`npm install @notifyforge/sdk
# or
yarn add @notifyforge/sdk
# or
bun add @notifyforge/sdk`}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> TypeScript SDK — quickstart</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">{`import { NotifyForge } from '@notifyforge/sdk';

const nf = new NotifyForge({ apiKey: process.env.NOTIFYFORGE_API_KEY! });

// 1. Register a device (mobile SDK does this automatically)
await nf.devices.register({
  channel: 'push_android',
  token: '<FCM token>',
  externalUserId: 'user-001',
  platform: 'android',
  appVersion: '1.4.2',
});

// 2. Send an Android push
const { id } = await nf.push.send({
  channel: 'push_android',
  target: { externalUserId: 'user-001' },
  payload: {
    title: 'Order shipped',
    body: 'Your order #12345 is on the way.',
    data: { orderId: '12345' },
    android: { priority: 'high', collapseKey: 'order-status' },
  },
});

// 3. Send an email — explicitly, never auto-routed
await nf.email.send({
  target: { email: 'customer@example.com' },
  payload: {
    from: 'notifications@notifyforge.dev',
    to: 'customer@example.com',
    subject: 'Receipt #12345',
    html: '<h1>Thanks!</h1>',
  },
});`}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> iOS (APNs) — full feature set</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">{`await nf.push.send({
  channel: 'push_ios',
  target: { externalUserId: 'user-001' },
  payload: {
    alert: { title: 'New message', body: 'Sarah sent a photo' },
    badge: 3,
    sound: 'default',
    category: 'MESSAGE_CATEGORY',
    'mutable-content': 1,         // Notification Service Extension
    'content-available': 1,        // silent push
    'interruption-level': 'time-sensitive',
    'apns-push-type': 'alert',
    'apns-priority': 10,
    'apns-topic': 'com.example.app',
    'apns-collapse-id': 'msg-sarah',
    data: { threadId: 'msg-sarah' },
  },
});`}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> Webhook with HMAC verification</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">{`// Sender
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

// Receiver (must verify signature)
import crypto from 'node:crypto';

function verifyNotifyForgeSignature(
  body: string,
  signature: string, // header X-NotifyForge-Signature = "sha256=..."
  timestamp: string, // header X-NotifyForge-Timestamp
  secret: string,
  toleranceSec = 300,
) {
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
  if (age > toleranceSec) throw new Error('replay detected');
  const expected = crypto
    .createHmac('sha256', secret)
    .update(\`\${timestamp}.\${body}\`)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.slice(7)))) {
    throw new Error('invalid signature');
  }
}`}</pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4" /> Available SDKs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'Kotlin', 'Swift', 'C#', 'PHP', 'Flutter', 'React Native', 'Unity', 'Node.js'].map((s) => (
              <div key={s} className="rounded-md border border-border bg-muted/30 px-3 py-2 text-center text-xs font-medium">
                {s}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            All SDKs share an identical API shape and are auto-generated from the same OpenAPI spec.
            Each SDK exposes strongly-typed <code>nf.push</code>, <code>nf.email</code>, <code>nf.sms</code>,
            <code>nf.webpush</code>, <code>nf.inapp</code>, <code>nf.webhook</code>, <code>nf.desktop</code> clients.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Architecture overview</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">{`┌─────────────────────────────────────────────────────────────────┐
│                          Client SDKs                             │
│   TS/JS · Python · Go · Rust · Java · Kotlin · Swift · C# · …    │
└──────────────┬──────────────────────────────────────────────────┘
               │  HTTPS + Bearer API key
               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway (stateless)                     │
│  Auth · Rate-limit · RBAC · Audit · Replay protection · TLS     │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
   /push/send /email/send /sms/send /webpush/send /inapp/send  …
       │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Push Eng │ │ Email Eng│ │ SMS Eng  │ │WebPush E │ │ In-App E │  …
│  (FCM/   │ │(SendGrid/│ │(Twilio/  │ │(VAPID/   │ │(Polling) │
│  APNs/HMS)│ │ SES/SMTP)│ │ Vonage)  │ │  RFC8030)│ │          │
└─────┬────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘ └─────┬────┘
      │            │            │            │            │
      └────────────┴────────────┴────────────┴────────────┘
                               │
                               ▼
                   ┌───────────────────────┐
                   │  Worker Queue (BullMQ │
                   │  + Redis in prod)     │
                   │  retry · backoff ·    │
                   │  DLQ                  │
                   └──────┬────────────────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
  PostgreSQL         Redis             ClickHouse
  (tenancy,          (cache,           (analytics,
   devices,           rate-limit        metrics,
   notifications)     buckets)          rollups)

  Observability: Prometheus + OpenTelemetry + Grafana + Loki
  Deploy: Docker · Kubernetes · Helm · Blue-Green · HPA`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
