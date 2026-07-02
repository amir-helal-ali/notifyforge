'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelBadge } from '@/components/dashboard/badges';
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Activity, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProviderHealth {
  id: string;
  channel: string;
  provider: string;
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  latencyMs: number | null;
  lastCheckedAt: string;
  lastIncidentAt: string | null;
  uptimePercent: number;
  errorRate: number;
  description: string;
}

const STATUS_CONFIG = {
  operational: { label: 'يعمل', color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: CheckCircle2 },
  degraded: { label: 'متدهور', color: 'text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30', icon: AlertTriangle },
  down: { label: 'متوقف', color: 'text-red-300', bg: 'bg-red-500/15', border: 'border-red-500/30', icon: XCircle },
  unknown: { label: 'غير معروف', color: 'text-zinc-300', bg: 'bg-zinc-500/15', border: 'border-zinc-500/30', icon: HelpCircle },
};

export function ProvidersSection() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/providers')
      .then((r) => r.json())
      .then((d) => setProviders(d ?? []))
      .finally(() => setLoading(false));
    const t = setInterval(() => {
      fetch('/api/dashboard/providers').then((r) => r.json()).then((d) => setProviders(d ?? []));
    }, 30000);
    return () => clearInterval(t);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      </div>
    );
  }

  const operational = providers.filter((p) => p.status === 'operational').length;
  const degraded = providers.filter((p) => p.status === 'degraded').length;
  const down = providers.filter((p) => p.status === 'down').length;
  const overallStatus = down > 0 ? 'down' : degraded > 0 ? 'degraded' : 'operational';
  const overallLabel = down > 0 ? 'خلل في النظام' : degraded > 0 ? 'أداء متدهور' : 'كل الأنظمة تعمل';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">مراقبة المزودين</h1>
        <p className="text-sm text-muted-foreground">
          الحالة التشغيلية لكل مزود خدمة إشعارات. تُحدَّث كل 30 ثانية.
        </p>
      </div>

      <Card className={cn('border', STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG].border)}>
        <CardContent className="p-6 flex items-center gap-4">
          <div className={cn('flex h-14 w-14 items-center justify-center rounded-full', STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG].bg)}>
            {(() => {
              const Icon = STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG].icon;
              return <Icon className={cn('h-7 w-7', STATUS_CONFIG[overallStatus as keyof typeof STATUS_CONFIG].color)} />;
            })()}
          </div>
          <div className="flex-1">
            <div className="text-lg font-semibold">{overallLabel}</div>
            <div className="text-sm text-muted-foreground">
              {operational} يعمل · {degraded} متدهور · {down} متوقف · {providers.length} الإجمالي
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((p) => {
          const cfg = STATUS_CONFIG[p.status];
          const Icon = cfg.icon;
          return (
            <Card key={p.id} className={cn('border', cfg.border)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <div className="mt-1"><ChannelBadge channel={p.channel} /></div>
                  </div>
                  <div className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium', cfg.bg, cfg.border, cfg.color)}>
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="text-muted-foreground">{p.description}</div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                  <div>
                    <div className="text-muted-foreground">زمن الاستجابة</div>
                    <div className="font-mono font-medium">{p.latencyMs !== null ? `${p.latencyMs} مللي` : '—'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">نسبة التشغيل</div>
                    <div className="font-mono font-medium text-emerald-300">{p.uptimePercent}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">معدل الأخطاء</div>
                    <div className={cn('font-mono font-medium', p.errorRate > 3 ? 'text-red-300' : p.errorRate > 1 ? 'text-amber-300' : 'text-emerald-300')}>{p.errorRate}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">آخر فحص</div>
                    <div className="font-mono">{new Date(p.lastCheckedAt).toLocaleTimeString('ar-EG')}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" /> كيف يتم قياس الحالة؟</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span><strong className="text-foreground">الفحوص الدورية:</strong> ترسل المنصة إشعارات تجريبية (canary) كل 30 ثانية لكل مزود وتقيس زمن الاستجابة.</span>
          </div>
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span><strong className="text-foreground">معدل الأخطاء:</strong> يُحسب من نسبة الإشعارات الفاشلة خلال آخر دقيقة. فوق 5% يُحدِّد الحالة إلى "متدهور"، فوق 20% إلى "متوقف".</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span><strong className="text-foreground">الإجراءات التلقائية:</strong> عند تدهور مزود، تُرسَل تنبيهات إلى Alertmanager وتُفعَّل صفحات الحالة العامة.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
