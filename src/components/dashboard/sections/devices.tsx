'use client';

import { useEffect, useState, useCallback } from 'react';
import { dashboardApi, type DeviceRow } from '@/lib/dashboard-api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelBadge, StatusBadge, EmptyState } from '@/components/dashboard/badges';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RefreshCw } from 'lucide-react';

export function DevicesSection() {
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');
  const [externalUserId, setExternalUserId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.devices({
        channel: channel === 'all' ? undefined : channel,
        status: status === 'all' ? undefined : status,
        externalUserId: externalUserId || undefined,
        page,
        pageSize: 25,
      });
      setRows(res.data);
      setTotal(res.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [channel, status, externalUserId, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [channel, status, externalUserId]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">سجل الأجهزة</h1>
          <p className="text-sm text-muted-foreground">
            الـ tokens المسجَّلة بواسطة SDKs العملاء عبر كل القنوات. الإجمالي {total.toLocaleString('ar-EG')}.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="تصفية بمعرّف المستخدم الخارجي…"
              value={externalUserId}
              onChange={(e) => setExternalUserId(e.target.value)}
              className="flex-1 min-w-48"
            />
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-44"><SelectValue placeholder="القناة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل القنوات</SelectItem>
                <SelectItem value="push_android">أندرويد (FCM)</SelectItem>
                <SelectItem value="push_ios">iOS (APNs)</SelectItem>
                <SelectItem value="push_huawei">هواوي (HMS)</SelectItem>
                <SelectItem value="webpush">Web Push</SelectItem>
                <SelectItem value="desktop">سطح المكتب</SelectItem>
                <SelectItem value="inapp">داخل التطبيق</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="invalid">غير صالح</SelectItem>
                <SelectItem value="expired">منتهي</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : rows.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="لا توجد أجهزة مسجَّلة"
                hint="سجّل جهازاً عبر POST /api/v1/devices/register باستخدام SDK أو عبر مختبر API."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-right font-medium px-4 py-2.5">القناة</th>
                    <th className="text-right font-medium px-4 py-2.5">الـ Token</th>
                    <th className="text-right font-medium px-4 py-2.5">الحالة</th>
                    <th className="text-right font-medium px-4 py-2.5">المستخدم الخارجي</th>
                    <th className="text-right font-medium px-4 py-2.5">المنصة</th>
                    <th className="text-right font-medium px-4 py-2.5">إصدار التطبيق</th>
                    <th className="text-right font-medium px-4 py-2.5">آخر ظهور</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2.5"><ChannelBadge channel={d.channel} /></td>
                      <td className="px-4 py-2.5"><code className="text-xs">{d.token}</code></td>
                      <td className="px-4 py-2.5"><StatusBadge status={d.tokenStatus} /></td>
                      <td className="px-4 py-2.5 text-xs">{d.externalUserId ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs">{d.platform ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs">{d.appVersion ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString('ar-EG') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>الصفحة {page} — {rows.length} من {total.toLocaleString('ar-EG')}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                  <Button size="sm" variant="outline" disabled={rows.length < 25} onClick={() => setPage((p) => p + 1)}>التالي</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
