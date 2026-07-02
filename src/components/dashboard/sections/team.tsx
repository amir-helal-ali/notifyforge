'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, UserPlus, Mail, Shield, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'مالك',
  admin: 'مسؤول',
  developer: 'مطوّر',
  viewer: 'مشاهد',
};

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  admin: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  developer: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  viewer: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
};

export function TeamSection() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', name: '', role: 'developer' });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/team');
      const d = await res.json();
      setMembers(d?.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function inviteMember() {
    try {
      const res = await fetch('/api/dashboard/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invite),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error?.message ?? 'HTTP ' + res.status);
      toast({ title: 'تمت الدعوة', description: `${invite.email} انضم كـ ${ROLE_LABELS[invite.role]}` });
      setOpen(false);
      setInvite({ email: '', name: '', role: 'developer' });
      load();
    } catch (e) {
      toast({ title: 'فشل', description: (e as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">الفريق</h1>
          <p className="text-sm text-muted-foreground">أعضاء المؤسسة وأدوارهم (RBAC).</p>
        </div>
        <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4 ml-2" /> دعوة عضو</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">لا يوجد أعضاء بعد.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-right font-medium px-4 py-2.5">العضو</th>
                    <th className="text-right font-medium px-4 py-2.5">الدور</th>
                    <th className="text-right font-medium px-4 py-2.5">الحالة</th>
                    <th className="text-right font-medium px-4 py-2.5">آخر دخول</th>
                    <th className="text-right font-medium px-4 py-2.5">أُضيف في</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-bold">
                            {(m.name ?? m.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{m.name ?? m.email.split('@')[0]}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {m.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium', ROLE_STYLES[m.role])}>
                          <Shield className="h-3 w-3" /> {ROLE_LABELS[m.role] ?? m.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs',
                          m.status === 'active' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30')}>
                          {m.status === 'active' ? 'نشط' : m.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {m.lastLoginAt ? (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(m.lastLoginAt).toLocaleString('ar-EG')}</span>
                        ) : 'لم يسجل الدخول بعد'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleDateString('ar-EG')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3 text-sm">
          <div className="font-medium flex items-center gap-2"><Shield className="h-4 w-4" /> صلاحيات الأدوار</div>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(ROLE_LABELS).map(([role, label]) => (
              <div key={role} className="rounded-md border border-border bg-muted/30 p-3">
                <div className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium mb-2', ROLE_STYLES[role])}>
                  {label}
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {role === 'owner' && <div>كل الصلاحيات + حذف المؤسسة + تغيير الخطة</div>}
                  {role === 'admin' && <div>إدارة المشاريع + المفاتيح + الأعضاء</div>}
                  {role === 'developer' && <div>إرسال الإشعارات + إدارة الأجهزة والقوالب</div>}
                  {role === 'viewer' && <div>قراءة فقط لكل البيانات</div>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> دعوة عضو جديد</DialogTitle>
            <DialogDescription>سيتم إنشاء حساب للعضو وإضافته إلى مؤسستك.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="member@example.com" />
            </div>
            <div>
              <Label>الاسم (اختياري)</Label>
              <Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="اسم العضو" />
            </div>
            <div>
              <Label>الدور</Label>
              <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مسؤول</SelectItem>
                  <SelectItem value="developer">مطوّر</SelectItem>
                  <SelectItem value="viewer">مشاهد</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={inviteMember} disabled={!invite.email}><Plus className="h-4 w-4 ml-2" /> دعوة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
