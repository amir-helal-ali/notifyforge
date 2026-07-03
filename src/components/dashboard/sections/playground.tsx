'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { dashboardApi } from '@/lib/dashboard-api';
import { StatusBadge } from '@/components/dashboard/badges';

type ChannelKey = 'push_android' | 'push_ios' | 'push_huawei' | 'webpush' | 'email' | 'sms' | 'inapp' | 'webhook' | 'desktop';

interface Sample {
  target: unknown;
  payload: unknown;
  priority: 'normal' | 'high';
  description: string;
}

const SAMPLES: Record<ChannelKey, Sample> = {
  push_android: {
    description: 'Push لأندرويد عبر FCM بأولوية عالية ومفتاح طي (collapse key).',
    priority: 'high',
    target: { externalUserId: 'user-001' },
    payload: {
      title: 'تم شحن الطلب',
      body: 'طلبك رقم 12345 في الطريق.',
      data: { orderId: '12345', deepLink: 'myapp://orders/12345' },
      android: { priority: 'high', collapseKey: 'order-status', ttl: '60s' },
      fcmOptions: { analyticsLabel: 'order_shipped' },
    },
  },
  push_ios: {
    description: 'Push لـ iOS عبر APNs مع mutable-content (لـ Notification Service Extension) ومستوى مقاطعة.',
    priority: 'high',
    target: { externalUserId: 'user-001' },
    payload: {
      alert: { title: 'رسالة جديدة', body: 'لديك رسالة جديدة من سارة' },
      badge: 3,
      sound: 'default',
      category: 'MESSAGE_CATEGORY',
      'mutable-content': 1,
      'interruption-level': 'time-sensitive',
      'apns-priority': 10,
      'apns-push-type': 'alert',
      data: { threadId: 'msg-sarah', messageId: 'm_987' },
    },
  },
  push_huawei: {
    description: 'رسالة Huawei HMS Push Kit بأولوية HIGH.',
    priority: 'high',
    target: { externalUserId: 'user-001' },
    payload: {
      message: {
        notification: { title: 'عرض ترويجي', body: 'خصم 20% هذا الأسبوع!' },
        android: { urgency: 'HIGH', ttl: '60s', collapseKey: 1 },
      },
    },
  },
  webpush: {
    description: 'إشعار Web Push مع أزرار إجراء ومستوى إلحاح عالٍ.',
    priority: 'normal',
    target: { externalUserId: 'user-001' },
    payload: {
      title: 'اكتملت المزامنة في الخلفية',
      body: 'تمت مزامنة 3 عناصر جديدة.',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: 'sync',
      requireInteraction: false,
      urgency: 'high',
      actions: [
        { action: 'view', title: 'عرض' },
        { action: 'dismiss', title: 'تجاهل' },
      ],
      data: { url: '/inbox' },
    },
  },
  email: {
    description: 'بريد إلكتروني معاملي مع محتوى HTML و reply-to.',
    priority: 'normal',
    target: { email: 'customer@example.com' },
    payload: {
      from: 'notifications@notifyforge.dev',
      to: 'customer@example.com',
      replyTo: 'support@notifyforge.dev',
      subject: 'إيصال طلبك رقم 12345',
      html: '<h1>شكراً لشرائك!</h1><p>تم تأكيد الطلب <strong>#12345</strong>.</p>',
      text: 'شكراً لشرائك! تم تأكيد الطلب #12345.',
      category: 'transactional',
    },
  },
  sms: {
    description: 'رسالة SMS عبر Twilio مع رقم مُرسِل.',
    priority: 'normal',
    target: { phone: '+15551234567' },
    payload: {
      from: '+15550000000',
      to: '+15551234567',
      body: 'رمز التحقق الخاص بك هو 482739. ينتهي خلال 10 دقائق.',
      encoding: 'gsm7',
    },
  },
  inapp: {
    description: 'إشعار داخل التطبيق محفوظ للعميل ليسحبه.',
    priority: 'normal',
    target: { externalUserId: 'user-001' },
    payload: {
      userId: 'user-001',
      title: 'طلب صداقة',
      body: 'سارة تريد التواصل معك.',
      category: 'social',
      actionUrl: '/friends/requests',
      imageUrl: 'https://cdn.notifyforge.dev/sarah-avatar.png',
      priority: 'normal',
    },
  },
  webhook: {
    description: 'Webhook صادر مع توقيع HMAC-SHA256.',
    priority: 'normal',
    target: {},
    payload: {
      url: 'https://example.com/webhooks/notifyforge',
      method: 'POST',
      headers: { 'X-Tenant': 'acme' },
      body: { event: 'order.created', orderId: '12345', amount: 99.99 },
      signingKey: 'whsec_abc123',
      signingAlgo: 'hmac-sha256',
      retryPolicy: { maxAttempts: 5, backoffMs: 5000 },
    },
  },
  desktop: {
    description: 'إشعار سطح المكتب عبر SDK الخاص بـ NotifyForge.',
    priority: 'normal',
    target: { externalUserId: 'user-001' },
    payload: {
      title: 'اكتمل البناء',
      body: 'main #4521 نجح في 4د 12ث.',
      icon: '/build-icon.png',
      urgency: 'normal',
      actions: [{ action: 'view', title: 'عرض السجلات' }],
      data: { buildId: '4521' },
    },
  },
};

const CHANNEL_LABELS: Record<ChannelKey, string> = {
  push_android: 'أندرويد (FCM)',
  push_ios: 'iOS (APNs)',
  push_huawei: 'هواوي (HMS)',
  webpush: 'Web Push',
  email: 'البريد',
  sms: 'SMS',
  inapp: 'داخل التطبيق',
  webhook: 'Webhook',
  desktop: 'سطح المكتب',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفضة',
  normal: 'عادية',
  high: 'عالية',
  critical: 'حرجة',
};

export function PlaygroundSection() {
  const [channel, setChannel] = useState<ChannelKey>('push_android');
  const [target, setTarget] = useState<string>(JSON.stringify(SAMPLES.push_android.target, null, 2));
  const [payload, setPayload] = useState<string>(JSON.stringify(SAMPLES.push_android.payload, null, 2));
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'critical'>('normal');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; data?: any; error?: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const s = SAMPLES[channel];
    setTarget(JSON.stringify(s.target, null, 2));
    setPayload(JSON.stringify(s.payload, null, 2));
    setPriority(s.priority as any);
  }, [channel]);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const t = JSON.parse(target);
      const p = JSON.parse(payload);
      const res = await dashboardApi.sendTest({ channel, target: t, payload: p, priority });
      setResult({ ok: true, data: res });
      toast({ title: 'تم الإرسال', description: `تم وضع الإشعار ${res.id} في الطابور` });
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
      toast({ title: 'فشل', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">مختبر API</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          أرسل إشعاراً حقيقياً عبر أي قناة باستخدام مفتاح لوحة التحكم الرئيسي.
          المنصة تنفذ بالضبط ما تُرسِله — بلا توجيه بالذكاء الاصطناعي، بلا تبديل للقنوات.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">القناة</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as ChannelKey)}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SAMPLES) as ChannelKey[]).map((c) => (
                    <SelectItem key={c} value={c}>{CHANNEL_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger className="w-32 mr-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="critical">حرجة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{SAMPLES[channel].description}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">الهدف (JSON)</Label>
              <Textarea rows={6} value={target} onChange={(e) => setTarget(e.target.value)} className="font-mono text-xs" />
            </div>
            <div>
              <Label className="text-xs">الحمولة (JSON)</Label>
              <Textarea rows={14} value={payload} onChange={(e) => setPayload(e.target.value)} className="font-mono text-xs" />
            </div>
            <Button onClick={send} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
              إرسال عبر {CHANNEL_LABELS[channel]}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">النتيجة</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                أرسل إشعاراً لرؤية الاستجابة.
              </div>
            ) : result.ok ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">تم القبول</span>
                  <StatusBadge status={result.data.status} />
                </div>
                <div className="rounded-md bg-muted p-3 text-xs">
                  <div className="text-muted-foreground mb-1">معرّف الإشعار</div>
                  <code className="break-all">{result.data.id}</code>
                </div>
                <div className="rounded-md bg-muted p-3 text-xs">
                  <div className="text-muted-foreground mb-1">القناة</div>
                  <code>{result.data.channel}</code>
                </div>
                <div className="rounded-md bg-muted p-3 text-xs">
                  <div className="text-muted-foreground mb-1">وُضِع في الطابور في</div>
                  <code>{new Date(result.data.queuedAt).toLocaleString('ar-EG')}</code>
                </div>
                <p className="text-xs text-muted-foreground">
                  افتح تبويب <strong>الإشعارات</strong> لمشاهدة انتقال الحالة من
                  <code className="text-foreground"> في الانتظار</code> ←
                  <code className="text-foreground"> قيد المعالجة</code> ←
                  <code className="text-foreground"> تم التسليم</code>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-300">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">خطأ</span>
                </div>
                <pre className="rounded-md bg-red-500/5 border border-red-500/30 p-3 text-xs text-red-200 whitespace-pre-wrap">{result.error}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">مكافئ cURL</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-xs overflow-auto ltr-content">{buildCurl(channel, target, payload, priority)}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

function buildCurl(channel: ChannelKey, target: string, payload: string, priority: string): string {
  const endpoint = channel.startsWith('push') ? '/api/v1/push/send' : `/api/v1/${channel}/send`;
  const body = channel.startsWith('push')
    ? { channel, target: JSON.parse(target), payload: JSON.parse(payload), priority }
    : { target: JSON.parse(target), payload: JSON.parse(payload), priority };
  return `curl -X POST https://api.notifyforge.dev${endpoint} \\
  -H "Authorization: Bearer $NOTIFYFORGE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body, null, 2)}'`;
}
