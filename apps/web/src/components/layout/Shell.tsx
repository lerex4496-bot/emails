import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Mail,
  Users,
  Activity,
  Link2,
  Reply,
  KeyRound,
  Settings,
  ActivitySquare,
  BookOpen,
  Sun,
  Moon,
  PlusCircle,
  ShieldCheck,
} from 'lucide-react';

export type NavTab =
  | 'dashboard'
  | 'messages'
  | 'contacts'
  | 'activity'
  | 'links'
  | 'replies'
  | 'accounts'
  | 'settings'
  | 'diagnostics'
  | 'docs';

interface ShellProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenComposer: () => void;
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({
  activeTab,
  onTabChange,
  onOpenComposer,
  children,
}) => {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return (
      localStorage.getItem('mailtrace_theme') === 'dark' ||
      (!('mailtrace_theme' in localStorage) &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('mailtrace_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('mailtrace_theme', 'light');
    }
  }, [darkMode]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'messages', label: 'Messages', icon: Mail },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'links', label: 'Links', icon: Link2 },
    { id: 'replies', label: 'Replies', icon: Reply },
    { id: 'accounts', label: 'Accounts', icon: KeyRound },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'diagnostics', label: 'Diagnostics', icon: ActivitySquare },
    { id: 'docs', label: 'Documentation', icon: BookOpen },
  ] as const;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 select-none">
        {/* Logo and Brand */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-900 dark:text-slate-100 text-sm tracking-tight leading-none">
                MailTrace
              </h1>
              <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">
                Privacy-First
              </span>
            </div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Toggle theme"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Send Action */}
        <div className="p-3">
          <button
            onClick={onOpenComposer}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold shadow-sm transition"
          >
            <PlusCircle className="w-4 h-4" />
            Send Tracked Email
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as NavTab)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition text-left ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between">
          <span>v1.0.0 Open Source</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            Ready
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>MailTrace</span>
            <span>/</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">
              {activeTab}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Self-Hosted Local Mode</span>
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-6">{children}</section>
      </main>
    </div>
  );
};
