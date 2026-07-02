'use client';

import { useEffect, useState, useCallback } from 'react';
import { dashboardApi, type DeviceRow } from '@/lib/dashboard-api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChannelBadge, StatusBadge, EmptyState } from '@/components/dashboard/badges';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RefreshCw, Smartphone } from 'lucide-react';

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
          <h1 className="text-2xl font-semibold tracking-tight">Device Registry</h1>
          <p className="text-sm text-muted-foreground">
            Tokens registered by client SDKs across all channels. {total.toLocaleString()} total.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Filter by external user ID…"
              value={externalUserId}
              onChange={(e) => setExternalUserId(e.target.value)}
              className="flex-1 min-w-48"
            />
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                <SelectItem value="push_android">Android (FCM)</SelectItem>
                <SelectItem value="push_ios">iOS (APNs)</SelectItem>
                <SelectItem value="push_huawei">Huawei (HMS)</SelectItem>
                <SelectItem value="webpush">Web Push</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="inapp">In-App</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invalid">Invalid</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
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
                title="No devices registered"
                hint="Register a device via POST /api/v1/devices/register with your SDK or via the API Playground."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Channel</th>
                    <th className="text-left font-medium px-4 py-2.5">Token</th>
                    <th className="text-left font-medium px-4 py-2.5">Status</th>
                    <th className="text-left font-medium px-4 py-2.5">External User</th>
                    <th className="text-left font-medium px-4 py-2.5">Platform</th>
                    <th className="text-left font-medium px-4 py-2.5">App Version</th>
                    <th className="text-left font-medium px-4 py-2.5">Last seen</th>
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
                        {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <span>Page {page} — {rows.length} of {total.toLocaleString()}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={rows.length < 25} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
