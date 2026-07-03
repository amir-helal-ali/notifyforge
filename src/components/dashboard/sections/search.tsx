'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelBadge, StatusBadge } from '@/components/dashboard/badges';
import { Search, Bell, Smartphone, FolderKanban, AppWindow, FileText, KeyRound } from 'lucide-react';
import Link from 'next/link';

interface SearchResult {
  notifications: Array<{ id: string; channel: string; status: string; priority: string; createdAt: string }>;
  devices: Array<{ id: string; channel: string; token: string; externalUserId: string | null; tokenStatus: string; createdAt: string }>;
  projects: Array<{ id: string; name: string; slug: string; description: string | null }>;
  applications: Array<{ id: string; name: string; slug: string; platform: string }>;
  templates: Array<{ id: string; name: string; slug: string; channel: string }>;
  apiKeys: Array<{ id: string; name: string; keyPrefix: string; status: string }>;
}

export function SearchSection() {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) {
      queueMicrotask(() => setResult(null));
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/dashboard/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => { setResult(d); setLoading(false); })
        .catch(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const total = result
    ? result.notifications.length + result.devices.length + result.projects.length + result.applications.length + result.templates.length + result.apiKeys.length
    : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">البحث الشامل</h1>
        <p className="text-sm text-muted-foreground">ابحث عبر الإشعارات والأجهزة والمشاريع والتطبيقات والقوالب والمفاتيح.</p>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اكتب للبحث… (معرّف إشعار، مستخدم، اسم مشروع، إلخ)"
          className="pr-10 h-12 text-base"
          autoFocus
        />
      </div>

      {loading && (
        <div className="space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      )}

      {!loading && result && total === 0 && (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          لا توجد نتائج لـ &quot;{q}&quot;
        </CardContent></Card>
      )}

      {!loading && result && total > 0 && (
        <div className="space-y-4">
          {result.notifications.length > 0 && (
            <ResultGroup title="الإشعارات" icon={<Bell className="h-4 w-4" />} count={result.notifications.length}>
              {result.notifications.map((n) => (
                <div key={n.id} className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30">
                  <ChannelBadge channel={n.channel} />
                  <StatusBadge status={n.status} />
                  <code className="text-xs text-muted-foreground flex-1">{n.id}</code>
                  <span className="text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString('ar-EG')}</span>
                </div>
              ))}
            </ResultGroup>
          )}

          {result.devices.length > 0 && (
            <ResultGroup title="الأجهزة" icon={<Smartphone className="h-4 w-4" />} count={result.devices.length}>
              {result.devices.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30">
                  <ChannelBadge channel={d.channel} />
                  <code className="text-xs">{d.token}</code>
                  <span className="text-xs text-muted-foreground">{d.externalUserId ?? '—'}</span>
                  <StatusBadge status={d.tokenStatus} />
                </div>
              ))}
            </ResultGroup>
          )}

          {result.projects.length > 0 && (
            <ResultGroup title="المشاريع" icon={<FolderKanban className="h-4 w-4" />} count={result.projects.length}>
              {result.projects.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30">
                  <FolderKanban className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{p.name}</div>
                    <code className="text-xs text-muted-foreground">{p.slug}</code>
                  </div>
                  {p.description && <span className="text-xs text-muted-foreground">{p.description}</span>}
                </div>
              ))}
            </ResultGroup>
          )}

          {result.applications.length > 0 && (
            <ResultGroup title="التطبيقات" icon={<AppWindow className="h-4 w-4" />} count={result.applications.length}>
              {result.applications.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30">
                  <AppWindow className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{a.name}</div>
                    <code className="text-xs text-muted-foreground">{a.slug}</code>
                  </div>
                  <code className="text-xs">{a.platform}</code>
                </div>
              ))}
            </ResultGroup>
          )}

          {result.templates.length > 0 && (
            <ResultGroup title="القوالب" icon={<FileText className="h-4 w-4" />} count={result.templates.length}>
              {result.templates.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{t.name}</div>
                    <code className="text-xs text-muted-foreground">{t.slug}</code>
                  </div>
                  <ChannelBadge channel={t.channel} />
                </div>
              ))}
            </ResultGroup>
          )}

          {result.apiKeys.length > 0 && (
            <ResultGroup title="مفاتيح API" icon={<KeyRound className="h-4 w-4" />} count={result.apiKeys.length}>
              {result.apiKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 rounded-md border border-border/50 px-3 py-2 hover:bg-muted/30">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium text-sm">{k.name}</div>
                    <code className="text-xs text-muted-foreground">{k.keyPrefix}…</code>
                  </div>
                  <StatusBadge status={k.status} />
                </div>
              ))}
            </ResultGroup>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h3 className="font-medium text-sm">{title}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
        </div>
        <div className="space-y-1.5">{children}</div>
      </CardContent>
    </Card>
  );
}
