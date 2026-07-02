'use client';

import { useEffect, useState, useCallback } from 'react';
import { dashboardApi, type NotificationRow } from '@/lib/dashboard-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelBadge, StatusBadge, PriorityBadge, EmptyState } from '@/components/dashboard/badges';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Search, Eye } from 'lucide-react';

export function NotificationsSection() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<NotificationRow | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            Every notification ever processed by the platform. {total.toLocaleString()} total.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by id, externalId, error…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="push_android">Android (FCM)</SelectItem>
                <SelectItem value="push_ios">iOS (APNs)</SelectItem>
                <SelectItem value="push_huawei">Huawei (HMS)</SelectItem>
                <SelectItem value="webpush">Web Push</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="inapp">In-App</SelectItem>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-4"><EmptyState title="No notifications found" hint="Adjust filters or send a test from the API Playground." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Channel</th>
                    <th className="text-left font-medium px-4 py-2.5">Status</th>
                    <th className="text-left font-medium px-4 py-2.5">Priority</th>
                    <th className="text-left font-medium px-4 py-2.5">Project / App</th>
                    <th className="text-left font-medium px-4 py-2.5">Provider</th>
                    <th className="text-left font-medium px-4 py-2.5">Attempts</th>
                    <th className="text-left font-medium px-4 py-2.5">Created</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n) => (
                    <tr key={n.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5"><ChannelBadge channel={n.channel} /></td>
                      <td className="px-4 py-2.5"><StatusBadge status={n.status} /></td>
                      <td className="px-4 py-2.5"><PriorityBadge priority={n.priority} /></td>
                      <td className="px-4 py-2.5 text-xs">
                        <div className="font-medium">{n.project?.name ?? '—'}</div>
                        <div className="text-muted-foreground">{n.application?.name ?? '—'}</div>
                      </td>
                      <td className="px-4 py-2.5"><code className="text-xs">{n.provider ?? '—'}</code></td>
                      <td className="px-4 py-2.5 tabular-nums text-xs">{n.attemptCount}/{n.maxAttempts}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</td>
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
                <span>Page {page} — showing {filtered.length} of {total.toLocaleString()}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={filtered.length < 25} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Notification detail</DialogTitle>
            <DialogDescription>Full notification metadata, provider response, and lifecycle events.</DialogDescription>
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
  if (!data) return <div className="p-4 text-sm text-muted-foreground">Not found.</div>;

  return (
    <ScrollArea className="max-h-[60vh]">
      <div className="space-y-4 p-1">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <DetailRow label="Notification ID" value={data.id} mono />
          <DetailRow label="External ID" value={data.externalId ?? '—'} mono />
          <DetailRow label="Channel" value={<ChannelBadge channel={data.channel} />} />
          <DetailRow label="Status" value={<StatusBadge status={data.status} />} />
          <DetailRow label="Priority" value={<PriorityBadge priority={data.priority} />} />
          <DetailRow label="Provider" value={data.provider ?? '—'} mono />
          <DetailRow label="Provider Message ID" value={data.providerMessageId ?? '—'} mono />
          <DetailRow label="Attempts" value={`${data.attemptCount} / ${data.maxAttempts}`} />
          <DetailRow label="Created" value={new Date(data.createdAt).toLocaleString()} />
          <DetailRow label="Sent" value={data.sentAt ? new Date(data.sentAt).toLocaleString() : '—'} />
          <DetailRow label="Delivered" value={data.deliveredAt ? new Date(data.deliveredAt).toLocaleString() : '—'} />
          <DetailRow label="Failed" value={data.failedAt ? new Date(data.failedAt).toLocaleString() : '—'} />
        </div>

        {data.errorCode && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs">
            <div className="font-mono font-semibold text-red-300">{data.errorCode}</div>
            <div className="mt-1 text-red-200/80">{data.errorMessage}</div>
          </div>
        )}

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payload</div>
          <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-40">{JSON.stringify(data.payload, null, 2)}</pre>
        </div>
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Target</div>
          <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-40">{JSON.stringify(data.target, null, 2)}</pre>
        </div>

        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lifecycle events</div>
          <div className="space-y-1">
            {data.events.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-2 py-1 text-xs">
                <span className="font-mono text-emerald-300">{e.type}</span>
                <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {data.logs && data.logs.length > 0 && (
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logs</div>
            <div className="space-y-1">
              {data.logs.map((l: any) => (
                <div key={l.id} className="flex items-center gap-3 rounded-md border border-border bg-muted/20 px-2 py-1 text-xs">
                  <span className={`font-mono ${l.level === 'error' ? 'text-red-300' : l.level === 'warn' ? 'text-amber-300' : 'text-blue-300'}`}>[{l.level}]</span>
                  <span className="font-mono text-muted-foreground">{l.stage}</span>
                  <span className="flex-1">{l.message}</span>
                  <span className="text-muted-foreground">{new Date(l.createdAt).toLocaleTimeString()}</span>
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
