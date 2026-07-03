'use client';

import { useEffect, useState, useCallback } from 'react';
import { dashboardApi, type AuditRow } from '@/lib/dashboard-api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw } from 'lucide-react';

const ACTION_LABELS_AR: Record<string, string> = {
  'device.register': 'تسجيل جهاز',
  'device.invalidate': 'إلغاء جهاز',
  'project.create': 'إنشاء مشروع',
  'app.create': 'إنشاء تطبيق',
  'api_key.create': 'إنشاء مفتاح API',
  'template.create': 'إنشاء قالب',
  'notification.cancel': 'إلغاء إشعار',
};

export function AuditSection() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.audit({ action: action || undefined, page, pageSize: 50 });
      setRows(res.data);
      setTotal(res.pagination.total);
    } finally { setLoading(false); }
  }, [action, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [action]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">سجل التدقيق</h1>
          <p className="text-sm text-muted-foreground">سجل غير قابل للتعديل لكل استدعاء API يُغيِّر الحالة. {total.toLocaleString('ar-EG')} حدث.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} /> تحديث
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="تصفية بالإجراء (مثال: notification.send.push, device.register, api_key.create)…"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="max-w-xl"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <div className="p-4"><EmptyState title="لا توجد أحداث تدقيق" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-right font-medium px-4 py-2.5">الوقت</th>
                    <th className="text-right font-medium px-4 py-2.5">الإجراء</th>
                    <th className="text-right font-medium px-4 py-2.5">المورد</th>
                    <th className="text-right font-medium px-4 py-2.5">المشروع</th>
                    <th className="text-right font-medium px-4 py-2.5">IP</th>
                    <th className="text-right font-medium px-4 py-2.5">بيانات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((a) => (
                    <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(a.createdAt).toLocaleString('ar-EG')}</td>
                      <td className="px-4 py-2.5"><code className="text-xs">{ACTION_LABELS_AR[a.action] ?? a.action}</code></td>
                      <td className="px-4 py-2.5"><code className="text-xs text-muted-foreground">{a.resource ?? '—'}</code></td>
                      <td className="px-4 py-2.5 text-xs">{a.project?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.ip ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        {a.meta ? <code className="text-[10px] text-muted-foreground">{JSON.stringify(a.meta).slice(0, 80)}</code> : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>الصفحة {page} — {rows.length} من {total.toLocaleString('ar-EG')}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                  <Button size="sm" variant="outline" disabled={rows.length < 50} onClick={() => setPage((p) => p + 1)}>التالي</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
