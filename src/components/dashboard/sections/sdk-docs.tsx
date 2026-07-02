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
        <h1 className="text-2xl font-semibold tracking-tight">SDK والوثائق</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          SDKs بأنواع قوية لكل المنصات الرئيسية. SDK TypeScript معروض أدناه؛
          Rust و Go و Python و Java و Kotlin و Swift و C# و PHP و Flutter و React Native و Unity تتبع نفس الشكل.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" /> مفتاح API الرئيسي الخاص بك</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-xs break-all">{masterKey ?? 'غير متاح'}</code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  if (masterKey) {
                    navigator.clipboard.writeText(masterKey);
                    toast({ title: 'تم النسخ' });
                  }
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            هذا المفتاح يملك كل النطاقات. استخدمه للتطوير المحلي فقط — أنشئ مفاتيح محدودة النطاق من تبويب مفاتيح API للإنتاج.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Code2 className="h-4 w-4" /> SDK TypeScript — التثبيت</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-xs overflow-auto ltr-content">{`npm install @notifyforge/sdk
# أو
yarn add @notifyforge/sdk
# أو
bun add @notifyforge/sdk`}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> SDK TypeScript — البدء السريع</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-xs overflow-auto ltr-content">{`import { NotifyForge } from '@notifyforge/sdk';

const nf = new NotifyForge({ apiKey: process.env.NOTIFYFORGE_API_KEY! });

// 1. تسجيل جهاز (SDK الهاتف يفعل ذلك تلقائياً)
await nf.devices.register({
  channel: 'push_android',
  token: '<FCM token>',
  externalUserId: 'user-001',
  platform: 'android',
  appVersion: '1.4.2',
});

// 2. إرسال Push لأندرويد
const { id } = await nf.push.send({
  channel: 'push_android',
  target: { externalUserId: 'user-001' },
  payload: {
    title: 'تم شحن الطلب',
    body: 'طلبك رقم 12345 في الطريق.',
    data: { orderId: '12345' },
    android: { priority: 'high', collapseKey: 'order-status' },
  },
});

// 3. إرسال بريد — بشكل صريح، بلا إعادة توجيه
await nf.email.send({
  target: { email: 'customer@example.com' },
  payload: {
    from: 'notifications@notifyforge.dev',
    to: 'customer@example.com',
    subject: 'إيصال #12345',
    html: '<h1>شكراً!</h1>',
  },
});`}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> iOS (APNs) — الميزات الكاملة</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-xs overflow-auto ltr-content">{`await nf.push.send({
  channel: 'push_ios',
  target: { externalUserId: 'user-001' },
  payload: {
    alert: { title: 'رسالة جديدة', body: 'سارة أرسلت صورة' },
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
            <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" /> Webhook مع التحقق من HMAC</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="rounded-md bg-muted p-4 text-xs overflow-auto ltr-content">{`// المُرسِل
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

// المستلِم (يجب التحقق من التوقيع)
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
          <CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4" /> SDKs المتاحة</CardTitle>
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
            كل الـ SDKs تشترك في شكل API متطابق وتُولَّد تلقائياً من نفس مواصفة OpenAPI.
            كل SDK يعرض عملاء بأنواع قوية: <code>nf.push</code>، <code>nf.email</code>، <code>nf.sms</code>،
            <code>nf.webpush</code>، <code>nf.inapp</code>، <code>nf.webhook</code>، <code>nf.desktop</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">نظرة عامة على البنية المعمارية</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-xs overflow-auto ltr-content">{`┌─────────────────────────────────────────────────────────────────┐
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
