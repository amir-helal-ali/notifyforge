'use client';

import { useEffect, useState, useCallback } from 'react';
import { dashboardApi, type ProjectRow, type AppRow, type ApiKeyRow, type TemplateRow } from '@/lib/dashboard-api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/dashboard/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Copy, Trash2, KeyRound, FolderKanban, AppWindow, FileText } from 'lucide-react';

export function ProjectsSection() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', slug: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.projects({ pageSize: 100 });
      setRows(res.data);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    try {
      await dashboardApi.createProject({ name: form.name, slug: form.slug || undefined, description: form.description || undefined });
      toast({ title: 'Project created', description: form.name });
      setOpen(false);
      setForm({ name: '', slug: '', description: '' });
      load();
    } catch (e) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">Tenant isolation boundary. Each project has its own applications, API keys, and devices.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New project</Button>
      </div>
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No projects" hint="Create your first project." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FolderKanban className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <code className="text-xs text-muted-foreground">{p.slug}</code>
                    </div>
                  </div>
                </div>
                {p.description && <p className="mt-3 text-xs text-muted-foreground">{p.description}</p>}
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                  <div><div className="font-semibold tabular-nums">{p._count.applications}</div><div className="text-muted-foreground">apps</div></div>
                  <div><div className="font-semibold tabular-nums">{p._count.devices}</div><div className="text-muted-foreground">devices</div></div>
                  <div><div className="font-semibold tabular-nums">{p._count.notifications}</div><div className="text-muted-foreground">notif</div></div>
                  <div><div className="font-semibold tabular-nums">{p._count.apiKeys}</div><div className="text-muted-foreground">keys</div></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <CreateDialog
        open={open}
        onOpenChange={setOpen}
        title="Create project"
        description="A project isolates applications, devices, and API keys."
        onSubmit={submit}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Project" />
          </div>
          <div>
            <Label htmlFor="slug">Slug (optional)</Label>
            <Input id="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="my-project" />
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What is this project for?" />
          </div>
        </div>
      </CreateDialog>
    </div>
  );
}

export function AppsSection() {
  const [rows, setRows] = useState<AppRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ projectId: '', name: '', slug: '', platform: 'mobile_android', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [appsRes, projRes] = await Promise.all([
        dashboardApi.apps({ pageSize: 100 }),
        dashboardApi.projects({ pageSize: 100 }),
      ]);
      setRows(appsRes.data);
      setProjects(projRes.data);
      if (!form.projectId && projRes.data[0]) setForm((f) => ({ ...f, projectId: projRes.data[0].id }));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    try {
      await dashboardApi.createApp({ projectId: form.projectId, name: form.name, slug: form.slug || undefined, platform: form.platform, description: form.description || undefined });
      toast({ title: 'Application created' });
      setOpen(false);
      setForm({ ...form, name: '', slug: '', description: '' });
      load();
    } catch (e) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground">Each application represents a client SDK integration (mobile app, web app, backend service).</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New application</Button>
      </div>
      {loading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState title="No applications" />
      ) : (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Name</th>
                  <th className="text-left font-medium px-4 py-2.5">Project</th>
                  <th className="text-left font-medium px-4 py-2.5">Platform</th>
                  <th className="text-right font-medium px-4 py-2.5">Devices</th>
                  <th className="text-right font-medium px-4 py-2.5">Notifications</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{a.name}</div>
                      <code className="text-xs text-muted-foreground">{a.slug}</code>
                    </td>
                    <td className="px-4 py-2.5 text-xs">{a.project.name}</td>
                    <td className="px-4 py-2.5"><code className="text-xs">{a.platform}</code></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a._count.devices}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a._count.notifications}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}
      <CreateDialog open={open} onOpenChange={setOpen} title="Create application" description="Apps map to client SDK integrations." onSubmit={submit}>
        <div className="space-y-3">
          <div>
            <Label>Project</Label>
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Android App" />
          </div>
          <div>
            <Label>Platform</Label>
            <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mobile_android">Android</SelectItem>
                <SelectItem value="mobile_ios">iOS</SelectItem>
                <SelectItem value="mobile_huawei">Huawei</SelectItem>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="desktop">Desktop</SelectItem>
                <SelectItem value="backend">Backend</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CreateDialog>
    </div>
  );
}

export function ApiKeysSection() {
  const [rows, setRows] = useState<ApiKeyRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState<{ key: string; name: string } | null>(null);
  const { toast } = useToast();
  const [form, setForm] = useState({ projectId: '', name: '', rateLimit: '1000', scopes: ['*'] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [keysRes, projRes] = await Promise.all([
        dashboardApi.apiKeys({ pageSize: 100 }),
        dashboardApi.projects({ pageSize: 100 }),
      ]);
      setRows(keysRes.data);
      setProjects(projRes.data);
      if (!form.projectId && projRes.data[0]) setForm((f) => ({ ...f, projectId: projRes.data[0].id }));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    try {
      const res = await dashboardApi.createApiKey({
        projectId: form.projectId,
        name: form.name,
        rateLimit: parseInt(form.rateLimit, 10) || 1000,
        scopes: form.scopes,
      });
      setRevealed({ key: (res as any).key, name: form.name });
      setOpen(false);
      setForm({ ...form, name: '' });
      load();
    } catch (e) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    }
  }

  async function revoke(id: string) {
    try {
      await dashboardApi.revokeApiKey(id);
      toast({ title: 'API key revoked' });
      load();
    } catch (e) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">API Keys</h1>
          <p className="text-sm text-muted-foreground">Scoped credentials used by client SDKs. The full key is shown only once at creation time.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New API key</Button>
      </div>
      {loading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState title="No API keys" />
      ) : (
        <Card><CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Name</th>
                  <th className="text-left font-medium px-4 py-2.5">Prefix</th>
                  <th className="text-left font-medium px-4 py-2.5">Project</th>
                  <th className="text-left font-medium px-4 py-2.5">Scopes</th>
                  <th className="text-right font-medium px-4 py-2.5">Rate limit</th>
                  <th className="text-left font-medium px-4 py-2.5">Last used</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{k.name}</div>
                      <div className="text-xs text-muted-foreground capitalize">{k.status}</div>
                    </td>
                    <td className="px-4 py-2.5"><code className="text-xs">{k.keyPrefix}…</code></td>
                    <td className="px-4 py-2.5 text-xs">{k.project?.name ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {k.scopes.slice(0, 3).map((s) => (
                          <code key={s} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{s}</code>
                        ))}
                        {k.scopes.length > 3 && <span className="text-[10px] text-muted-foreground">+{k.scopes.length - 3}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">{k.rateLimit}/min</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'never'}</td>
                    <td className="px-4 py-2.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => revoke(k.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent></Card>
      )}
      <CreateDialog open={open} onOpenChange={setOpen} title="Create API key" description="The full key will be shown ONCE after creation." onSubmit={submit}>
        <div className="space-y-3">
          <div>
            <Label>Project</Label>
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Production server key" />
          </div>
          <div>
            <Label>Rate limit (requests per minute)</Label>
            <Input type="number" value={form.rateLimit} onChange={(e) => setForm({ ...form, rateLimit: e.target.value })} />
          </div>
          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            New keys default to all scopes (<code>*</code>). Use the public API to create keys with restricted scopes.
          </div>
        </div>
      </CreateDialog>

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> API key created</DialogTitle>
            <DialogDescription>
              Copy your new API key now. <strong className="text-foreground">You will not be able to see it again.</strong>
            </DialogDescription>
          </DialogHeader>
          {revealed && (
            <div className="space-y-3">
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="mb-1 text-xs text-muted-foreground">Name</div>
                <div className="font-medium">{revealed.name}</div>
              </div>
              <div className="rounded-md border border-border bg-muted p-3">
                <div className="mb-1 text-xs text-muted-foreground">Full API key</div>
                <code className="block break-all text-xs">{revealed.key}</code>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(revealed.key);
                  toast({ title: 'Copied to clipboard' });
                }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy key
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TemplatesSection() {
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({ projectId: '', channel: 'email', name: '', slug: '', subject: '', body: '', description: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        dashboardApi.templates({ pageSize: 100 }),
        dashboardApi.projects({ pageSize: 100 }),
      ]);
      setRows(tRes.data);
      setProjects(pRes.data);
      if (!form.projectId && pRes.data[0]) setForm((f) => ({ ...f, projectId: pRes.data[0].id }));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    try {
      await dashboardApi.createTemplate({
        projectId: form.projectId,
        channel: form.channel,
        name: form.name,
        slug: form.slug || undefined,
        subject: form.subject || undefined,
        body: form.body,
        description: form.description || undefined,
      });
      toast({ title: 'Template created' });
      setOpen(false);
      setForm({ ...form, name: '', slug: '', subject: '', body: '', description: '' });
      load();
    } catch (e) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground">Reusable, channel-scoped message templates with <code className="text-xs">{`{{variable}}`}</code> interpolation.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New template</Button>
      </div>
      {loading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState title="No templates" hint="Create a template for any channel." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      <code className="text-xs text-muted-foreground">{t.channel} · v{t.version}</code>
                    </div>
                  </div>
                </div>
                {t.subject && <div className="mt-3 text-xs"><span className="text-muted-foreground">Subject:</span> {t.subject}</div>}
                <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-muted p-2 text-xs whitespace-pre-wrap">{t.body}</pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <CreateDialog open={open} onOpenChange={setOpen} title="Create template" description="Reusable content with {{variable}} placeholders." onSubmit={submit}>
        <div className="space-y-3">
          <div>
            <Label>Project</Label>
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Channel</Label>
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['push_android', 'push_ios', 'push_huawei', 'webpush', 'email', 'sms', 'inapp', 'webhook', 'desktop'].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Welcome email" />
          </div>
          {form.channel === 'email' && (
            <div>
              <Label>Subject</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Welcome to {{app_name}}" />
            </div>
          )}
          <div>
            <Label>Body</Label>
            <Textarea rows={6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Hello {{name}}, …" />
          </div>
        </div>
      </CreateDialog>
    </div>
  );
}

function CreateDialog({ open, onOpenChange, title, description, onSubmit, children }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
