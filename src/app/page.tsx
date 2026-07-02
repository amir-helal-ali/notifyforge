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
import { Activity, Bell, Send, BarChart3, Smartphone, FolderKanban, AppWindow, KeyRound, FileText, ScrollText, FlaskConical, BookOpen, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type SectionId =
  | 'overview' | 'channels' | 'notifications' | 'analytics'
  | 'devices' | 'projects' | 'apps' | 'api-keys' | 'templates'
  | 'audit' | 'playground' | 'sdk-docs';

interface NavItem {
  id: SectionId;
  label: string;
  icon: React.ReactNode;
  group: 'admin' | 'developer';
}

const NAV: NavItem[] = [
  { id: 'overview',    label: 'Overview',     icon: <Activity className="h-4 w-4" />,     group: 'admin' },
  { id: 'channels',    label: 'Channels',     icon: <Bell className="h-4 w-4" />,         group: 'admin' },
  { id: 'notifications', label: 'Notifications', icon: <Send className="h-4 w-4" />,      group: 'admin' },
  { id: 'analytics',   label: 'Analytics',    icon: <BarChart3 className="h-4 w-4" />,    group: 'admin' },
  { id: 'devices',     label: 'Devices',      icon: <Smartphone className="h-4 w-4" />,   group: 'admin' },
  { id: 'projects',    label: 'Projects',     icon: <FolderKanban className="h-4 w-4" />, group: 'admin' },
  { id: 'apps',        label: 'Applications', icon: <AppWindow className="h-4 w-4" />,    group: 'admin' },
  { id: 'api-keys',    label: 'API Keys',     icon: <KeyRound className="h-4 w-4" />,     group: 'admin' },
  { id: 'templates',   label: 'Templates',    icon: <FileText className="h-4 w-4" />,     group: 'admin' },
  { id: 'audit',       label: 'Audit Log',    icon: <ScrollText className="h-4 w-4" />,   group: 'admin' },
  { id: 'playground',  label: 'API Playground', icon: <FlaskConical className="h-4 w-4" />, group: 'developer' },
  { id: 'sdk-docs',    label: 'SDK & Docs',   icon: <BookOpen className="h-4 w-4" />,     group: 'developer' },
];

export default function Home() {
  const [section, setSection] = useState<SectionId>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // On mount, sync section with URL hash (if any).
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.slice(1);
      if (h && NAV.some((n) => n.id === h)) setSection(h as SectionId);
    };
    // Defer to avoid synchronous setState-in-effect lint rule
    queueMicrotask(apply);
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  const select = (id: SectionId) => {
    setSection(id);
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${id}`);
    }
    setSidebarOpen(false);
  };

  const adminItems = NAV.filter((n) => n.group === 'admin');
  const devItems = NAV.filter((n) => n.group === 'developer');

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
        <button
          className="lg:hidden -ml-1 p-1 rounded-md hover:bg-muted"
          onClick={() => setSidebarOpen((s) => !s)}
          aria-label="Toggle sidebar"
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
            <span className="font-semibold tracking-tight">NotifyForge</span>
            <span className="text-[10px] text-muted-foreground">Notification Infrastructure</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1 text-xs text-emerald-300">
            <ShieldCheck className="h-3 w-3" /> enterprise plan
          </span>
          <span className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> all systems operational
          </span>
        </div>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className={cn(
          'fixed lg:sticky top-14 z-30 h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r border-border bg-background overflow-y-auto transition-transform',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}>
          <nav className="p-3 space-y-6">
            <div>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Admin Dashboard</div>
              <div className="space-y-0.5">
                {adminItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => select(item.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                      section === item.id
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent',
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Developer</div>
              <div className="space-y-0.5">
                {devItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => select(item.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                      section === item.id
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent',
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
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

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
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
          {section === 'playground'    && <PlaygroundSection />}
          {section === 'sdk-docs'      && <SdkDocsSection />}
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-background/95 px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>NotifyForge · Notification Infrastructure Platform · v1.0.0</div>
          <div className="hidden md:block">
            Channel isolation · No AI routing · Explicit client choice · Production-grade
          </div>
        </div>
      </footer>
    </div>
  );
}
