'use client';

import { useEffect, useState } from 'react';
import { OverviewSection } from '@/components/dashboard/sections/overview';
import { ChannelsSection } from '@/components/dashboard/sections/channels';
import { NotificationsSection } from '@/components/dashboard/sections/notifications';
import { AnalyticsSection } from '@/components/dashboard/sections/analytics';
import { DevicesSection } from '@/components/dashboard/sections/devices';
import { ProjectsSection, AppsSection, ApiKeysSection, TemplatesSection } from '@/components/dashboard/sections/management';
import { AuditSection } from '@/components/dashboard/sections/audit';
import { PlaygroundSection } from '@/components/dashboard/sections/playground';
import { SdkDocsSection } from '@/components/dashboard/sections/sdk-docs';
import { ProvidersSection } from '@/components/dashboard/sections/providers';
import { SettingsSection } from '@/components/dashboard/sections/settings';
import { TeamSection } from '@/components/dashboard/sections/team';
import { SearchSection } from '@/components/dashboard/sections/search';
import { Activity, Bell, Send, BarChart3, Smartphone, FolderKanban, AppWindow, KeyRound, FileText, ScrollText, FlaskConical, BookOpen, ShieldCheck, Search, Users, HeartPulse, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sun, Moon } from 'lucide-react';

type SectionId =
  | 'overview' | 'channels' | 'notifications' | 'analytics'
  | 'devices' | 'projects' | 'apps' | 'api-keys' | 'templates'
  | 'audit' | 'playground' | 'sdk-docs'
  | 'providers' | 'settings' | 'team' | 'search';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  group: 'admin' | 'developer' | 'system';
}

const NAV: NavItem[] = [
  { id: 'search',       label: 'بحث',             icon: <Search className="h-4 w-4" />,         group: 'system' },
  { id: 'overview',     label: 'النظرة العامة',   icon: <Activity className="h-4 w-4" />,       group: 'admin' },
  { id: 'channels',     label: 'القنوات',         icon: <Bell className="h-4 w-4" />,           group: 'admin' },
  { id: 'notifications',label: 'الإشعارات',       icon: <Send className="h-4 w-4" />,           group: 'admin' },
  { id: 'analytics',    label: 'التحليلات',       icon: <BarChart3 className="h-4 w-4" />,      group: 'admin' },
  { id: 'devices',      label: 'الأجهزة',         icon: <Smartphone className="h-4 w-4" />,     group: 'admin' },
  { id: 'projects',     label: 'المشاريع',        icon: <FolderKanban className="h-4 w-4" />,   group: 'admin' },
  { id: 'apps',         label: 'التطبيقات',       icon: <AppWindow className="h-4 w-4" />,      group: 'admin' },
  { id: 'api-keys',     label: 'مفاتيح API',      icon: <KeyRound className="h-4 w-4" />,       group: 'admin' },
  { id: 'templates',    label: 'القوالب',         icon: <FileText className="h-4 w-4" />,       group: 'admin' },
  { id: 'audit',        label: 'سجل التدقيق',     icon: <ScrollText className="h-4 w-4" />,     group: 'admin' },
  { id: 'providers',    label: 'صحة المزودين',    icon: <HeartPulse className="h-4 w-4" />,     group: 'system' },
  { id: 'team',         label: 'الفريق',          icon: <Users className="h-4 w-4" />,          group: 'system' },
  { id: 'settings',     label: 'الإعدادات',       icon: <Sliders className="h-4 w-4" />,        group: 'system' },
  { id: 'playground',   label: 'مختبر API',       icon: <FlaskConical className="h-4 w-4" />,   group: 'developer' },
  { id: 'sdk-docs',     label: 'SDK والوثائق',   icon: <BookOpen className="h-4 w-4" />,       group: 'developer' },
];

export default function Home() {
  const [section, setSection] = useState<SectionId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.slice(1);
      if (h && NAV.some((n) => n.id === h)) setSection(h as SectionId);
    };
    queueMicrotask(apply);
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  // Theme: read saved preference on mount + apply changes to <html>.
  useEffect(() => {
    const saved = localStorage.getItem('nf-theme') as 'dark' | 'light' | null;
    queueMicrotask(() => { if (saved) setTheme(saved); });
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('nf-theme', theme);
  }, [theme]);

  const select = (id: SectionId) => {
    setSection(id);
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${id}`);
    }
    setSidebarOpen(false);
  };

  const adminItems = NAV.filter((n) => n.group === 'admin');
  const devItems = NAV.filter((n) => n.group === 'developer');
  const systemItems = NAV.filter((n) => n.group === 'system');

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
        <button
          className="lg:hidden -ml-1 p-1 rounded-md hover:bg-muted"
          onClick={() => setSidebarOpen((s) => !s)}
          aria-label="تبديل القائمة الجانبية"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-emerald-400 to-emerald-600 text-white font-bold text-sm">
            NF
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-semibold tracking-tight">نوتيفاي فورج</span>
            <span className="text-[10px] text-muted-foreground">البنية التحتية للإشعارات</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => select('search')}
            className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            <Search className="h-3.5 w-3.5" /> بحث…
            <kbd className="rounded border border-border bg-background px-1 text-[10px]">/</kbd>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
            aria-label="تبديل الوضع"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-xs text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> خطة المؤسسات
          </span>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className={cn(
          'fixed lg:sticky top-14 z-30 h-[calc(100vh-3.5rem)] w-60 shrink-0 border-l border-border bg-background overflow-y-auto transition-transform',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
        )}>
          <nav className="p-3 space-y-6">
            <div>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">النظام</div>
              <div className="space-y-0.5">
                {systemItems.map((item) => (
                  <NavButton key={item.id} item={item} active={section === item.id} onClick={() => select(item.id)} />
                ))}
              </div>
            </div>
            <div>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">لوحة المسؤول</div>
              <div className="space-y-0.5">
                {adminItems.map((item) => (
                  <NavButton key={item.id} item={item} active={section === item.id} onClick={() => select(item.id)} />
                ))}
              </div>
            </div>
            <div>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">المطوّر</div>
              <div className="space-y-0.5">
                {devItems.map((item) => (
                  <NavButton key={item.id} item={item} active={section === item.id} onClick={() => select(item.id)} />
                ))}
              </div>
            </div>
          </nav>
        </aside>

        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 top-14 z-20 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {section === 'search'        && <SearchSection />}
          {section === 'overview'      && <OverviewSection />}
          {section === 'channels'      && <ChannelsSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'analytics'     && <AnalyticsSection />}
          {section === 'devices'       && <DevicesSection />}
          {section === 'projects'      && <ProjectsSection />}
          {section === 'apps'          && <AppsSection />}
          {section === 'api-keys'      && <ApiKeysSection />}
          {section === 'templates'     && <TemplatesSection />}
          {section === 'audit'         && <AuditSection />}
          {section === 'providers'     && <ProvidersSection />}
          {section === 'team'          && <TeamSection />}
          {section === 'settings'      && <SettingsSection />}
          {section === 'playground'    && <PlaygroundSection />}
          {section === 'sdk-docs'      && <SdkDocsSection />}
        </main>
      </div>

      <footer className="mt-auto border-t border-border bg-background/95 px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>نوتيفاي فورج · منصة البنية التحتية للإشعارات · الإصدار 1.0.0</div>
          <div className="hidden md:block">
            عزل القنوات · بلا توجيه بالذكاء الاصطناعي · اختيار صريح للعميل · جاهز للإنتاج
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent',
      )}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  );
}
