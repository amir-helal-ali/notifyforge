'use client';

import { useEffect, useState, useCallback } from 'react';
import { dashboardApi, type NotificationRow } from '@/lib/dashboard-api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelBadge, StatusBadge, PriorityBadge, EmptyState } from '@/components/dashboard/badges';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Search, Eye, Download, Ban, RotateCcw, CheckSquare, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function NotificationsSection() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<NotificationRow | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.notifications({
        channel: channel === 'all' ? undefined : channel,
        status: status === 'all' ? undefined : status,
        page,
        pageSize: 25,
      });
      setRows(res.data);
      setTotal(res.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [channel, status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [channel, status]);

  const filtered = search
    ? rows.filter((r) =>
        r.id.includes(search) ||
        r.externalId?.includes(search) ||
        r.providerMessageId?.includes(search) ||
        r.errorCode?.includes(search))
    : rows;

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (checked.size === filtered.length) {
      setChecked(new Set());
    } else {
      setChecked(new Set(filtered.map((r) => r.id)));
    }
  }

  function exportNotifications(format: 'csv' | 'json', filters: { channel: string; status: string }) {
    const params = new URLSearchParams({ format });
    if (filters.channel !== 'all') params.set('channel', filters.channel);
    if (filters.status !== 'all') params.set('status', filters.status);
    // Master key is required for export endpoint — fetch it then redirect
    fetch('/api/dashboard/master-key')
      .then((r) => r.json())
      .then((d) => {
        const url = `/api/v1/notifications/export?${params.toString()}`;
        // Use fetch with auth header to download
        fetch(url, { headers: { Authorization: `Bearer ${d.fullKey}` } })
          .then((r) => r.blob())
          .then((blob) => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `notifications-${Date.now()}.${format}`;
            a.click();
            URL.revokeObjectURL(a.href);
            toast({ title: 'تم التصدير', description: `${format.toUpperCase()} — ${filtered.length} صف` });
          });
      });
  }

  async function bulkAction(action: 'cancel' | 'retry') {
    const ids = Array.from(checked);
    try {
      const res = await fetch(`/api/v1/notifications/bulk-${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const masterRes = await fetch('/api/dashboard/master-key');
      const masterData = await masterRes.json();
      const res2 = await fetch(`/api/v1/notifications/bulk-${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${masterData.fullKey}` },
        body: JSON.stringify({ ids }),
      });
      const d = await res2.json();
      if (!res2.ok) throw new Error(d?.error?.message ?? 'HTTP ' + res2.status);
      const label = action === 'cancel' ? 'إلغاء' : 'إعادة محاولة';
      toast({ title: `تم ${label}`, description: `${d[action === 'cancel' ? 'cancelled' : 'retried']} من ${d.requested}` });
      setChecked(new Set());
      load();
    } catch (e) {
      toast({ title: 'فشل', description: (e as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">الإشعارات</h1>
          <p className="text-sm text-muted-foreground">
            كل إشعار تمت معالجته على المنصة. الإجمالي {total.toLocaleString('ar-EG')}.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} /> تحديث
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportNotifications('csv', { channel, status })}
          >
            <Download className="h-4 w-4 ml-2" /> تصدير CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportNotifications('json', { channel, status })}
          >
            <Download className="h-4 w-4 ml-2" /> تصدير JSON
          </Button>
          {checked.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-amber-300 border-amber-500/30"
                onClick={() => bulkAction('cancel')}
              >
                <Ban className="h-4 w-4 ml-2" /> إلغاء ({checked.size})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-blue-300 border-blue-500/30"
                onClick={() => bulkAction('retry')}
              >
                <RotateCcw className="h-4 w-4 ml-2" /> إعادة محاولة ({checked.size})
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="تصفية بالمعرّف، externalId، الخطأ…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-8"
              />
            </div>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-44"><SelectValue placeholder="القناة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل القنوات</SelectItem>
                <SelectItem value="push_android">أندرويد (FCM)</SelectItem>
                <SelectItem value="push_ios">iOS (APNs)</SelectItem>
                <SelectItem value="push_huawei">هواوي (HMS)</SelectItem>
                <SelectItem value="webpush">Web Push</SelectItem>
                <SelectItem value="email">البريد</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="inapp">داخل التطبيق</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="desktop">سطح المكتب</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="queued">في الانتظار</SelectItem>
                <SelectItem value="processing">قيد المعالجة</SelectItem>
                <SelectItem value="sent">مُرسَل</SelectItem>
                <SelectItem value="delivered">تم التسليم</SelectItem>
                <SelectItem value="failed">فشل</SelectItem>
                <SelectItem value="cancelled">ملغى</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-4"><EmptyState title="لا توجد إشعارات" hint="عدّل الفلاتر أو أرسل إشعاراً تجريبياً من مختبر API." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 w-8">
                      <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                        {checked.size === filtered.length && filtered.length > 0
                          ? <CheckSquare className="h-4 w-4" />
                          : <Square className="h-4 w-4" />}
                      </button>
                    </th>
                    <th className="text-right font-medium px-4 py-2.5">القناة</th>
                    <th className="text-right font-medium px-4 py-2.5">الحالة</th>
                    <th className="text-right font-medium px-4 py-2.5">الأولوية</th>
                    <th className="text-right font-medium px-4 py-2.5">المشروع / التطبيق</th>
                    <th className="text-right font-medium px-4 py-2.5">المزوّد</th>
                    <th className="text-right font-medium px-4 py-2.5">المحاولات</th>
                    <th className="text-right font-medium px-4 py-2.5">تاريخ الإنشاء</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n) => (
                    <tr key={n.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5">
                        <button onClick={() => toggleCheck(n.id)} className="text-muted-foreground hover:text-foreground">
                          {checked.has(n.id)
                            ? <CheckSquare className="h-4 w-4 text-emerald-400" />
                            : <Square className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-2.5"><ChannelBadge channel={n.channel} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={n.status} /></td>
                      <td className="px-4 py-2.5"><PriorityBadge priority={n.priority} /></td>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="font-medium">{n.project?.name ?? '—'}</div>
                        <div className="text-muted-foreground">{n.application?.name ?? '—'}</div>
                      </td>
                      <td className="px-4 py-2.5"><code className="text-xs">{n.provider ?? '—'}</code></td>
                      <td className="px-4 py-2.5 tabular-nums text-xs">{n.attemptCount}/{n.maxAttempts}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString('ar-EG')}</td>
                      <td className="px-4 py-2.5">
                        <Button variant="ghost" size="icon" onClick={() => setSelected(n)} className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>الصفحة {page} — عرض {filtered.length} من {total.toLocaleString('ar-EG')}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                  <Button size="sm" variant="outline" disabled={filtered.length < 25} onClick={() => setPage((p) => p + 1)}>التالي</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>تفاصيل الإشعار</DialogTitle>
            <DialogDescription>البيانات الكاملة للإشعار، استجابة المزوّد، وأحداث دورة الحياة.</DialogDescription>
          </DialogHeader>
          {selected && <NotificationDetail id={selected.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificationDetail({ id }: { id: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard/notifications/${id}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-4 space-y-2"><Skeleton className="h-6 w-1/3" /><Skeleton className="h-40" /></div>;
  if (!data) return <div className="p-4 text-sm text-muted-foreground">غير موجود.</div>;

  return (
    <ScrollArea className="max-h-[60vh]">
      <div className="space-y-4 p-1">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <DetailRow label="معرّف الإشعار" value={data.id} mono />
          <DetailRow label="المعرّف الخارجي" value={data.externalId ?? '—'} mono />
          <DetailRow label="القناة" value={<ChannelBadge channel={data.channel} />} />
          <DetailRow label="الحالة" value={<StatusBadge status={data.status} />} />
          <DetailRow label="الأولوية" value={<PriorityBadge priority={data.priority} />} />
          <DetailRow label="المزوّد" value={data.provider ?? '—'} mono />
          <DetailRow label="معرّف رسالة المزوّد" value={data.providerMessageId ?? '—'} mono />
          <DetailRow label="المحاولات" value={`${data.attemptCount} / ${data.maxAttempts}`} />
          <DetailRow label="أُنشئ في" value={new Date(data.createdAt).toLocaleString('ar-EG')} />
          <DetailRow label="أُرسِل في" value={data.sentAt ? new Date(data.sentAt).toLocaleString('ar-EG') : '—'} />
          <DetailRow label="تُسُلِّم في" value={data.deliveredAt ? new Date(data.deliveredAt).toLocaleString('ar-EG') : '—'} />
          <DetailRow label="فشل في" value={data.failedAt ? new Date(data.failedAt).toLocaleString('ar-EG') : '—'} />
        </div>

        {data.errorCode && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs">
            <div className="font-mono font-semibold text-red-300">{data.errorCode}</div>
            <div className="mt-1 text-red-200/80">{data.errorMessage}</div>
          </div>
        )}

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">الحمولة (Payload)</div>
          <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-40">{JSON.stringify(data.payload, null, 2)}</pre>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">الهدف (Target)</div>
          <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-40">{JSON.stringify(data.target, null, 2)}</pre>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">أحداث دورة الحياة</div>
          <div className="space-y-1">
            {data.events.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-2 py-1 text-xs">
                <span className="font-mono text-emerald-300">{e.type}</span>
                <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleString('ar-EG')}</span>
              </div>
            ))}
          </div>
        </div>

        {data.logs && data.logs.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">السجلات</div>
            <div className="space-y-1">
              {data.logs.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-2 py-1 text-xs">
                  <span className={`font-mono ${l.level === 'error' ? 'text-red-300' : l.level === 'warn' ? 'text-amber-300' : 'text-blue-300'}`}>[{l.level}]</span>
                  <span className="font-mono text-muted-foreground">{l.stage}</span>
                  <span className="flex-1">{l.message}</span>
                  <span className="text-muted-foreground">{new Date(l.createdAt).toLocaleTimeString('ar-EG')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono' : ''}>{value}</div>
    </div>
  );
}
