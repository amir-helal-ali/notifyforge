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
    description: 'Android push via FCM with high priority and collapse key.',
    priority: 'high',
    target: { externalUserId: 'user-001' },
    payload: {
      title: 'Order shipped',
      body: 'Your order #12345 is on the way.',
      data: { orderId: '12345', deepLink: 'myapp://orders/12345' },
      android: { priority: 'high', collapseKey: 'order-status', ttl: '60s' },
      fcmOptions: { analyticsLabel: 'order_shipped' },
    },
  },
  push_ios: {
    description: 'iOS push via APNs with mutable-content (for Notification Service Extension) and interruption-level.',
    priority: 'high',
    target: { externalUserId: 'user-001' },
    payload: {
      alert: { title: 'New message', body: 'You have 1 new message from Sarah' },
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
    description: 'Huawei HMS Push Kit message with urgency HIGH.',
    priority: 'high',
    target: { externalUserId: 'user-001' },
    payload: {
      message: {
        notification: { title: 'Promo', body: '20% off this weekend!' },
        android: { urgency: 'HIGH', ttl: '60s', collapseKey: 1 },
      },
    },
  },
  webpush: {
    description: 'Web Push notification with action buttons and high urgency.',
    priority: 'normal',
    target: { externalUserId: 'user-001' },
    payload: {
      title: 'Background sync complete',
      body: '3 new items were synced.',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      tag: 'sync',
      requireInteraction: false,
      urgency: 'high',
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
      data: { url: '/inbox' },
    },
  },
  email: {
    description: 'Transactional email with HTML body and reply-to.',
    priority: 'normal',
    target: { email: 'customer@example.com' },
    payload: {
      from: 'notifications@notifyforge.dev',
      to: 'customer@example.com',
      replyTo: 'support@notifyforge.dev',
      subject: 'Your receipt for order #12345',
      html: '<h1>Thanks for your purchase!</h1><p>Order <strong>#12345</strong> has been confirmed.</p>',
      text: 'Thanks for your purchase! Order #12345 has been confirmed.',
      category: 'transactional',
    },
  },
  sms: {
    description: 'SMS via Twilio with from-number.',
    priority: 'normal',
    target: { phone: '+15551234567' },
    payload: {
      from: '+15550000000',
      to: '+15551234567',
      body: 'Your verification code is 482739. It expires in 10 minutes.',
      encoding: 'gsm7',
    },
  },
  inapp: {
    description: 'In-app notification persisted for client polling.',
    priority: 'normal',
    target: { externalUserId: 'user-001' },
    payload: {
      userId: 'user-001',
      title: 'Friend request',
      body: 'Sarah wants to connect with you.',
      category: 'social',
      actionUrl: '/friends/requests',
      imageUrl: 'https://cdn.notifyforge.dev/sarah-avatar.png',
      priority: 'normal',
    },
  },
  webhook: {
    description: 'Outbound webhook with HMAC-SHA256 signature.',
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
    description: 'Desktop notification via NotifyForge Desktop SDK.',
    priority: 'normal',
    target: { externalUserId: 'user-001' },
    payload: {
      title: 'Build complete',
      body: 'main #4521 succeeded in 4m 12s.',
      icon: '/build-icon.png',
      urgency: 'normal',
      actions: [{ action: 'view', title: 'View logs' }],
      data: { buildId: '4521' },
    },
  },
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
      toast({ title: 'Sent', description: `Notification ${res.id} queued` });
    } catch (e) {
      setResult({ ok: false, error: (e as Error).message });
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Playground</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Send a real notification through any channel using the master dashboard key.
          The platform executes exactly what you submit — no AI routing, no channel switching.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as ChannelKey)}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SAMPLES) as ChannelKey[]).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger className="w-32 ml-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">low</SelectItem>
                  <SelectItem value="normal">normal</SelectItem>
                  <SelectItem value="high">high</SelectItem>
                  <SelectItem value="critical">critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{SAMPLES[channel].description}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Target (JSON)</Label>
              <Textarea rows={6} value={target} onChange={(e) => setTarget(e.target.value)} className="font-mono text-xs" />
            </div>
            <div>
              <Label className="text-xs">Payload (JSON)</Label>
              <Textarea rows={14} value={payload} onChange={(e) => setPayload(e.target.value)} className="font-mono text-xs" />
            </div>
            <Button onClick={send} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send via {channel}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Result</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Send a notification to see the response.
              </div>
            ) : result.ok ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Accepted</span>
                  <StatusBadge status={result.data.status} />
                </div>
                <div className="rounded-md bg-muted p-3 text-xs">
                  <div className="text-muted-foreground mb-1">Notification ID</div>
                  <code className="break-all">{result.data.id}</code>
                </div>
                <div className="rounded-md bg-muted p-3 text-xs">
                  <div className="text-muted-foreground mb-1">Channel</div>
                  <code>{result.data.channel}</code>
                </div>
                <div className="rounded-md bg-muted p-3 text-xs">
                  <div className="text-muted-foreground mb-1">Queued at</div>
                  <code>{new Date(result.data.queuedAt).toLocaleString()}</code>
                </div>
                <p className="text-xs text-muted-foreground">
                  Open the <strong>Notifications</strong> tab to watch the status transition from
                  <code className="text-foreground"> queued</code> →
                  <code className="text-foreground"> processing</code> →
                  <code className="text-foreground"> delivered</code>.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-red-300">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Error</span>
                </div>
                <pre className="rounded-md bg-red-500/5 border border-red-500/30 p-3 text-xs text-red-200 whitespace-pre-wrap">{result.error}</pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equivalent cURL</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-4 text-xs overflow-auto">{buildCurl(channel, target, payload, priority)}</pre>
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
