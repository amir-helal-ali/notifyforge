'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, Building2, Sliders, ShieldCheck, Globe } from 'lucide-react';

export function SettingsSection() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '',
    description: '',
    plan: 'enterprise',
    timezone: 'Africa/Cairo',
    locale: 'ar',
    defaultRateLimit: 1000,
    retentionDays: 90,
    enableRealtime: true,
    enableAnalytics: true,
    ipAllowlist: '',
  });

  useEffect(() => {
    fetch('/api/dashboard/settings')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setForm({
          name: d?.organization?.name ?? '',
          description: d?.project?.description ?? '',
          plan: d?.organization?.plan ?? 'enterprise',
          timezone: d?.settings?.timezone ?? 'Africa/Cairo',
          locale: d?.settings?.locale ?? 'ar',
          defaultRateLimit: d?.settings?.defaultRateLimit ?? 1000,
          retentionDays: d?.settings?.retentionDays ?? 90,
          enableRealtime: d?.settings?.enableRealtime ?? true,
          enableAnalytics: d?.settings?.enableAnalytics ?? true,
          ipAllowlist: d?.settings?.ipAllowlist ?? '',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, description: form.description, plan: form.plan }),
      });
      toast({ title: 'تم الحفظ', description: 'تم تحديث إعدادات المؤسسة' });
    } catch (e) {
      toast({ title: 'فشل', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">الإعدادات</h1>
          <p className="text-sm text-muted-foreground">إعدادات المؤسسة والمشروع والمنصة.</p>
        </div>
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 ml-2" /> {saving ? 'جارٍ الحفظ…' : 'حفظ التغييرات'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Building2 className="h-4 w-4" /> معلومات المؤسسة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>اسم المؤسسة</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>المعرّف (slug)</Label>
              <Input value={data.organization.slug} disabled className="font-mono text-xs" />
            </div>
            <div>
              <Label>الخطة</Label>
              <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">مجاني</SelectItem>
                  <SelectItem value="pro">احترافي</SelectItem>
                  <SelectItem value="enterprise">مؤسسات</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الحالة</Label>
              <Input value={data.organization.status === 'active' ? 'نشط' : data.organization.status} disabled />
            </div>
          </div>
          <div>
            <Label>وصف المشروع</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
            <div><div className="text-xs text-muted-foreground">الأعضاء</div><div className="text-2xl font-semibold tabular-nums">{data.organization.memberCount}</div></div>
            <div><div className="text-xs text-muted-foreground">المشاريع</div><div className="text-2xl font-semibold tabular-nums">{data.organization.projectCount}</div></div>
            <div><div className="text-xs text-muted-foreground">أُنشئت في</div><div className="text-sm font-medium">{new Date(data.organization.createdAt).toLocaleDateString('ar-EG')}</div></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Sliders className="h-4 w-4" /> إعدادات المنصة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>المنطقة الزمنية</Label>
              <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Africa/Cairo">القاهرة (GMT+2)</SelectItem>
                  <SelectItem value="Asia/Riyadh">الرياض (GMT+3)</SelectItem>
                  <SelectItem value="Asia/Dubai">دبي (GMT+4)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>اللغة الافتراضية</Label>
              <Select value={form.locale} onValueChange={(v) => setForm({ ...form, locale: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ar">العربية</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>حد المعدل الافتراضي (طلب/دقيقة)</Label>
              <Input type="number" value={form.defaultRateLimit} onChange={(e) => setForm({ ...form, defaultRateLimit: parseInt(e.target.value, 10) || 0 })} />
            </div>
            <div>
              <Label>مدة الاحتفاظ بالبيانات (أيام)</Label>
              <Input type="number" value={form.retentionDays} onChange={(e) => setForm({ ...form, retentionDays: parseInt(e.target.value, 10) || 0 })} />
            </div>
          </div>
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">الإشعارات اللحظية (WebSocket)</div>
                <div className="text-xs text-muted-foreground">دفع الإشعارات داخل التطبيق لحظياً للعملاء المتصلين</div>
              </div>
              <Switch checked={form.enableRealtime} onCheckedChange={(c) => setForm({ ...form, enableRealtime: c })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">التحليلات المتقدمة</div>
                <div className="text-xs text-muted-foreground">تجميع المقاييس في ClickHouse لبناء لوحات التحليلات</div>
              </div>
              <Switch checked={form.enableAnalytics} onCheckedChange={(c) => setForm({ ...form, enableAnalytics: c })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> الأمان</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> قائمة IP المسموحة (اختياري)</Label>
            <Input
              value={form.ipAllowlist}
              onChange={(e) => setForm({ ...form, ipAllowlist: e.target.value })}
              placeholder="192.168.1.0/24, 10.0.0.0/8"
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">اتركه فارغاً للسماح بكل IPs. افصل بين النطاقات بفواصل.</p>
          </div>
          <div>
            <Label>مفتاح توقيع Webhook</Label>
            <Input value={data.settings.webhookSigningKey} disabled className="font-mono text-xs" />
            <p className="mt-1 text-xs text-muted-foreground">يُستخدم لتوقيع كل الـ webhooks الصادرة بـ HMAC-SHA256.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
