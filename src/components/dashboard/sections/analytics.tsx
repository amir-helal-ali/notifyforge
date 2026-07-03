'use client';

import { useEffect, useState } from 'react';
import { dashboardApi, type AnalyticsData } from '@/lib/dashboard-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { KpiCard } from '@/components/dashboard/badges';
import { Button } from '@/components/ui/button';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, CheckCircle2, AlertCircle, Timer } from 'lucide-react';

const CHANNEL_COLORS: Record<string, string> = {
  push_android: '#10b981', push_ios: '#3b82f6', push_huawei: '#ef4444', webpush: '#8b5cf6',
  email: '#f59e0b', sms: '#06b6d4', inapp: '#ec4899', webhook: '#84cc16', desktop: '#a855f7',
};

const CHANNEL_LABELS_AR: Record<string, string> = {
  push_android: 'أندرويد',
  push_ios: 'iOS',
  push_huawei: 'هواوي',
  webpush: 'Web Push',
  email: 'البريد',
  sms: 'SMS',
  inapp: 'داخل التطبيق',
  webhook: 'Webhook',
  desktop: 'سطح المكتب',
};

export function AnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const d = await dashboardApi.analytics(range);
        if (!cancelled) { setData(d); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [range]);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const seriesData = data.series.map((s) => ({
    bucket: new Date(s.bucket).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', day: range === '7d' ? '2-digit' : undefined }),
    delivered: s.delivered,
    failed: s.failed,
    total: s.total,
  }));

  const channelRows = Object.entries(data.channels).map(([ch, v]) => ({
    channel: CHANNEL_LABELS_AR[ch] ?? ch,
    total: v.total,
    delivered: v.delivered,
    failed: v.failed,
    pending: v.pending,
    deliveryRate: Math.round(v.deliveryRate * 100),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">التحليلات</h1>
          <p className="text-sm text-muted-foreground">
            أداء التسليم، زمن الاستجابة، وتفصيل لكل قناة. مُجمَّع من أحداث الإشعارات الخام.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant={range === '24h' ? 'default' : 'outline'} onClick={() => setRange('24h')}>آخر 24 ساعة</Button>
          <Button size="sm" variant={range === '7d' ? 'default' : 'outline'} onClick={() => setRange('7d')}>آخر 7 أيام</Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <KpiCard label="معدل التسليم" value={`${(data.deliveryRate * 100).toFixed(1)}%`} accent="emerald" icon={<TrendingUp className="h-4 w-4" />} sub={`${data.delivered.toLocaleString('ar-EG')} من ${data.total.toLocaleString('ar-EG')}`} />
        <KpiCard label="فشل" value={data.failed} accent="red" icon={<AlertCircle className="h-4 w-4" />} sub="في النطاق المحدد" />
        <KpiCard label="قيد الانتظار" value={data.pending} accent="amber" icon={<CheckCircle2 className="h-4 w-4" />} sub="في الانتظار + قيد المعالجة" />
        <KpiCard label="زمن الاستجابة p50" value={`${data.latencyMs.p50.toFixed(0)} مللي`} accent="blue" icon={<Timer className="h-4 w-4" />} sub={`p99 ${data.latencyMs.p99.toFixed(0)} مللي`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">التسليم عبر الزمن</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={seriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="bucket" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, direction: 'rtl' }} />
                <Legend formatter={(value) => {
                  const map: Record<string, string> = { delivered: 'تم التسليم', failed: 'فشل', total: 'الإجمالي' };
                  return map[value as string] ?? value;
                }} />
                <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">أداء كل قناة</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-right font-medium px-4 py-2.5">القناة</th>
                  <th className="text-right font-medium px-4 py-2.5">الإجمالي</th>
                  <th className="text-right font-medium px-4 py-2.5">تم التسليم</th>
                  <th className="text-right font-medium px-4 py-2.5">فشل</th>
                  <th className="text-right font-medium px-4 py-2.5">قيد الانتظار</th>
                  <th className="text-right font-medium px-4 py-2.5">معدل التسليم</th>
                </tr>
              </thead>
              <tbody>
                {channelRows.map((r) => (
                  <tr key={r.channel} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <code className="text-xs">{r.channel}</code>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.total}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-300">{r.delivered}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-300">{r.failed}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-amber-300">{r.pending}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${r.deliveryRate}%` }} />
                        </div>
                        <span className="tabular-nums text-xs w-10 text-right">{r.deliveryRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">توزيع زمن الاستجابة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <LatencyBox label="p50" value={data.latencyMs.p50} />
            <LatencyBox label="p90" value={data.latencyMs.p90} />
            <LatencyBox label="p99" value={data.latencyMs.p99} />
            <LatencyBox label="المتوسط" value={data.latencyMs.avg} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            زمن الاستجابة = الوقت من قبول <code className="text-foreground">POST /send</code> إلى <code className="text-foreground">deliveredAt</code>.
            عمليات النشر الإنتاجية تُخزِّن هذه القيم في جداول تجميع ClickHouse.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LatencyBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value.toFixed(0)}<span className="text-sm text-muted-foreground"> مللي</span></div>
    </div>
  );
}
