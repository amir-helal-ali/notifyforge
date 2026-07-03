'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, XCircle, AlertCircle, KeyRound, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ProviderTestResult {
  id: string;
  name: string;
  configured: boolean;
  envVars: { name: string; set: boolean }[];
  notes: string;
}

export function IntegrationTestSection() {
  const [results, setResults] = useState<ProviderTestResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/dashboard/integration-test');
        const d = await r.json();
        if (!cancelled) setResults(d?.results ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  const configuredCount = results.filter((r) => r.configured).length;
  const totalCount = results.length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">اختبار التكامل</h1>
          <p className="text-sm text-muted-foreground">
            تحقق من تكوين كل مزود خدمة. المزودون غير المُكوَّنين يعملون في الوضع المحاكى.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          setLoading(true);
          fetch('/api/dashboard/integration-test')
            .then((r) => r.json())
            .then((d) => setResults(d?.results ?? []))
            .finally(() => setLoading(false));
        }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} /> إعادة الفحص
        </Button>
      </div>

      <Card className={cn('border', configuredCount === totalCount ? 'border-emerald-500/30' : configuredCount > 0 ? 'border-amber-500/30' : 'border-red-500/30')}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full',
              configuredCount === totalCount ? 'bg-emerald-500/15' : configuredCount > 0 ? 'bg-amber-500/15' : 'bg-red-500/15',
            )}>
              {configuredCount === totalCount
                ? <CheckCircle2 className="h-7 w-7 text-emerald-300" />
                : configuredCount > 0
                ? <AlertCircle className="h-7 w-7 text-amber-300" />
                : <XCircle className="h-7 w-7 text-red-300" />}
            </div>
            <div>
              <div className="text-lg font-semibold">
                {configuredCount === totalCount
                  ? 'كل المزودين مُكوَّنون'
                  : configuredCount > 0
                  ? `${configuredCount} من ${totalCount} مُكوَّن`
                  : 'لا يوجد مزودون مُكوَّنون'}
              </div>
              <div className="text-sm text-muted-foreground">
                {totalCount - configuredCount} في الوضع المحاكى
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {results.map((r) => (
            <Card key={r.id} className={cn('border', r.configured ? 'border-emerald-500/30' : 'border-zinc-700')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                    {r.name}
                  </CardTitle>
                  {r.configured ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" /> مُكوَّن
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-700/30 px-2 py-0.5 text-xs font-medium text-zinc-300">
                      <AlertCircle className="h-3 w-3" /> محاكى
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">{r.notes}</p>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">متغيرات البيئة</div>
                  <div className="space-y-1">
                    {r.envVars.map((v) => (
                      <div key={v.name} className="flex items-center justify-between text-xs">
                        <code className="text-muted-foreground">{v.name}</code>
                        {v.set ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> مضبوط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-zinc-500">
                            <XCircle className="h-3 w-3" /> غير مضبوط
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">كيفية تفعيل مزود حقيقي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>كل مزود يُفعَّل بضبط متغيرات البيئة المناسبة في ملف <code className="text-foreground">.env</code> ثم إعادة تشغيل الخادم.</p>
          <div className="rounded-md bg-muted p-3 text-xs ltr-content" dir="ltr">
            <pre>{`# FCM (Android Push)
FCM_SERVICE_ACCOUNT_JSON='{ "type": "service_account", "project_id": "...", ... }'

# APNs (iOS Push)
APNS_KEY_ID=ABC1234567
APNS_TEAM_ID=DEFGHIJKLM
APNS_BUNDLE_ID=com.example.app
APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIGT...\\n-----END PRIVATE KEY-----"
APNS_USE_SANDBOX=true

# Huawei HMS Push
HMS_APP_ID=10XXXXXXX
HMS_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# SendGrid (Email)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxx

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM=+15551234567

# Web Push (VAPID)
WEBPUSH_VAPID_PUBLIC_KEY=BJxxxxxxxxxxxxxxxxxxxx
WEBPUSH_VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
WEBPUSH_SUBJECT=mailto:admin@example.com`}</pre>
          </div>
          <p>عند تفعيل مزود، ستتحول كل الإشعارات المُرسَلة عبر تلك القناة من الوضع المحاكى إلى الإرسال الحقيقي تلقائياً.</p>
        </CardContent>
      </Card>
    </div>
  );
}
