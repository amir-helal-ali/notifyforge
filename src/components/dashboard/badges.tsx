'use client';

import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    processing: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    sent: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    delivered: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    failed: 'bg-red-500/15 text-red-300 border-red-500/30',
    cancelled: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    invalid: 'bg-red-500/15 text-red-300 border-red-500/30',
    expired: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    revoked: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  const cls = styles[status] ?? 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', cls)}>
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    low: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    normal: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    high: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  };
  const cls = styles[priority] ?? styles.normal;
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide', cls)}>
      {priority}
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const labels: Record<string, string> = {
    push_android: 'Android (FCM)',
    push_ios: 'iOS (APNs)',
    push_huawei: 'Huawei (HMS)',
    webpush: 'Web Push',
    email: 'Email',
    sms: 'SMS',
    inapp: 'In-App',
    webhook: 'Webhook',
    desktop: 'Desktop',
  };
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium">
      {labels[channel] ?? channel}
    </span>
  );
}

export function KpiCard({
  label,
  value,
  sub,
  accent = 'default',
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'default' | 'emerald' | 'red' | 'amber' | 'blue';
  icon?: React.ReactNode;
}) {
  const accents: Record<string, string> = {
    default: 'border-border',
    emerald: 'border-emerald-500/30',
    red: 'border-red-500/30',
    amber: 'border-amber-500/30',
    blue: 'border-blue-500/30',
  };
  const valueColors: Record<string, string> = {
    default: 'text-foreground',
    emerald: 'text-emerald-300',
    red: 'text-red-300',
    amber: 'text-amber-300',
    blue: 'text-blue-300',
  };
  return (
    <div className={cn('rounded-lg border bg-card p-5', accents[accent])}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <div className={cn('mt-2 text-3xl font-semibold tabular-nums', valueColors[accent])}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-12 text-center">
      <div className="text-sm font-medium text-foreground">{title}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
