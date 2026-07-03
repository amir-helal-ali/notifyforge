'use client';

import { useEffect, useState } from 'react';
import { dashboardApi, type ChannelInfo } from '@/lib/dashboard-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelBadge } from '@/components/dashboard/badges';
import { Smartphone, Mail, MessageSquare, Globe, Bell, Webhook, Monitor, Send } from 'lucide-react';

const ICONS: Record<string, React.ReactNode> = {
  push_android: <Smartphone className="h-5 w-5" />,
  push_ios: <Smartphone className="h-5 w-5" />,
  push_huawei: <Smartphone className="h-5 w-5" />,
  email: <Mail className="h-5 w-5" />,
  sms: <MessageSquare className="h-5 w-5" />,
  webpush: <Globe className="h-5 w-5" />,
  inapp: <Bell className="h-5 w-5" />,
  webhook: <Webhook className="h-5 w-5" />,
  desktop: <Monitor className="h-5 w-5" />,
};

export function ChannelsSection() {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardApi.channels()
      .then(setChannels)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">القنوات</h1>
        <p className="text-sm text-muted-foreground max-w-3xl">
          كل قناة هي خدمة معزولة لها نقطة API مستقلة، طابور عمال مستقل، وتكامل مع مزود خاص بها.
          المنصة لا تقوم أبداً بإعادة التوجيه بين القنوات — العميل يحدد بوضوح إلى أين يُرسِل.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {channels.map((ch) => (
          <Card key={ch.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-base">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    {ICONS[ch.id]}
                  </div>
                  {ch.name}
                </CardTitle>
                <ChannelBadge channel={ch.id} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">المزوّد</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ch.provider}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">نقطة النهاية</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ch.endpoint}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">الصلاحية</span>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{ch.scope}</code>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">إجمالي المُرسَل</span>
                <span className="text-lg font-semibold tabular-nums">{ch.totalSent.toLocaleString('ar-EG')}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
