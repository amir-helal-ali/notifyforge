'use client';

import { useEffect, useState } from 'react';
import { dashboardApi, type OverviewData } from '@/lib/dashboard-api';
import { KpiCard } from '@/components/dashboard/badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, Bell, Send, Smartphone, KeyRound, FileText, FolderKanban } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';

const CHANNEL_COLORS: Record<string, string> = {
  push_android: '#10b981',
  push_ios: '#3b82f6',
  push_huawei: '#ef4444',
  webpush: '#8b5cf6',
  email: '#f59e0b',
  sms: '#06b6d4',
  inapp: '#ec4899',
  webhook: '#84cc16',
  desktop: '#a855f7',
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

const STATUS_LABELS_AR: Record<string, string> = {
  queued: 'في الانتظار',
  processing: 'قيد المعالجة',
  sent: 'مُرسَل',
  delivered: 'تم التسليم',
  failed: 'فشل',
  cancelled: 'ملغى',
};

export function OverviewSection() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      try {
        const d = await dashboardApi.overview();
        if (mounted) { setData(d); setLoading(false); }
      } catch (e) {
        if (mounted) { setError((e as Error).message); setLoading(false); }
      }
    };
    run();
    const t = setInterval(() => {
      dashboardApi.overview().then((d) => mounted && setData(d)).catch(() => {});
    }, 15000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  if (loading) return <OverviewSkeleton />;
  if (error) return <div className="text-red-400">خطأ: {error}</div>;
  if (!data) return null;

  // بناء سلسلة البيانات للرسم البياني
  const seriesData: { bucket: string; [k: string]: string | number }[] = [];
  const buckets = data.byChannel.length > 0
    ? Object.values(data.series)[0]?.map((b) => b.bucket) ?? []
    : [];
  for (const bucket of buckets) {
    const row: { bucket: string; [k: string]: string | number } = { bucket };
    for (const ch of data.byChannel) {
      const point = data.series[ch.channel]?.find((b) => b.bucket === bucket);
      row[ch.channel] = point?.count ?? 0;
    }
    seriesData.push(row);
  }

  const statusData = data.byStatus.map((s) => ({ name: STATUS_LABELS_AR[s.status] ?? s.status, value: s.count }));
  const statusColors: Record<string, string> = {
    queued: '#f59e0b', processing: '#3b82f6', sent: '#06b6d4',
    delivered: '#10b981', failed: '#ef4444', cancelled: '#71717a',
  };

  const channelBars = data.byChannel.map((c) => ({
    name: CHANNEL_LABELS_AR[c.channel] ?? c.channel,
    count: c.count,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">النظرة العامة على المنصة</h1>
        <p className="text-sm text-muted-foreground">
          عرض لحظي عبر كل القنوات والمشاريع. يُحدّث كل 15 ثانية.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="الإشعارات (24س)" value={data.counts.last24h} accent="blue" icon={<Bell className="h-4 w-4" />} />
        <KpiCard label="إجمالي المُرسَل" value={data.counts.notifications} accent="emerald" icon={<Send className="h-4 w-4" />} />
        <KpiCard label="الأجهزة" value={data.counts.devices} icon={<Smartphone className="h-4 w-4" />} />
        <KpiCard label="المشاريع" value={data.counts.projects} icon={<FolderKanban className="h-4 w-4" />} />
        <KpiCard label="مفاتيح API" value={data.counts.apiKeys} icon={<KeyRound className="h-4 w-4" />} />
        <KpiCard label="القوالب" value={data.counts.templates} icon={<FileText className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> الإشعارات — آخر 24 ساعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seriesData}>
                  <defs>
                    {Object.keys(CHANNEL_COLORS).map((ch) => (
                      <linearGradient key={ch} id={`grad-${ch}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHANNEL_COLORS[ch]} stopOpacity={0.5} />
                        <stop offset="95%" stopColor={CHANNEL_COLORS[ch]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="bucket"
                    tickFormatter={(v) => new Date(v).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={11}
                  />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, direction: 'rtl' }}
                    labelFormatter={(v) => new Date(v as string).toLocaleString('ar-EG')}
                  />
                  <Legend formatter={(value) => CHANNEL_LABELS_AR[value as string] ?? value} />
                  {data.byChannel.map((ch) => (
                    <Area
                      key={ch.channel}
                      type="monotone"
                      dataKey={ch.channel}
                      stackId="1"
                      stroke={CHANNEL_COLORS[ch.channel]}
                      fill={`url(#grad-${ch.channel})`}
                      strokeWidth={1.5}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">توزيع الحالات</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {statusData.map((s) => (
                      <Cell key={s.name} fill={statusColors[s.name] ?? '#71717a'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, direction: 'rtl' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">الإشعارات لكل قناة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelBars}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={11} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, direction: 'rtl' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {data.byChannel.map((c) => (
                    <Cell key={c.channel} fill={CHANNEL_COLORS[c.channel] ?? '#71717a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-72" />
      <Skeleton className="h-64" />
    </div>
  );
}
