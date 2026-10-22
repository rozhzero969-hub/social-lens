'use client';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellOff,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  FolderHeart,
  Globe,
  Home,
  Link2,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Trash2,
  Users,
  X,
  Camera,
  Music2,
  AlertCircle,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  AppData,
  Change,
  defaultPreferences,
  emptyData,
  Platform,
  Preferences,
  Profile,
  Report,
} from '@/lib/types';
import { clientAction, socialConnectionsReady, startSocialConnection } from '@/lib/client-actions';
import { capabilities, profileUrl } from '@/lib/platforms';
import { inQuietHours, localClock } from '@/lib/monitoring';
import AuthScreen from './auth-screen';
import Logo from './logo';
import SocialEmbed from './social-embed';
import ProfileViewer from './profile-viewer';
import { profileEmbed } from '@/lib/embeds';
type Page = 'Home' | 'Accounts' | 'Profiles' | 'Reports' | 'Inbox' | 'Saved' | 'Settings';
type DialogName = 'connect' | 'profile' | 'bookmark' | 'delete' | 'install' | null;
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const nav = [
  { name: 'Home', icon: Home },
  { name: 'Accounts', icon: Link2 },
  { name: 'Profiles', icon: Users },
  { name: 'Reports', icon: FileText },
  { name: 'Inbox', icon: Bell },
  { name: 'Saved', icon: Bookmark },
] as const;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const label = (p: Platform) => (p === 'instagram' ? 'Instagram' : 'TikTok');
function PlatformIcon({ platform, size = 18 }: { platform: Platform; size?: number }) {
  return platform === 'instagram' ? <Camera size={size} /> : <Music2 size={size} />;
}
function date(value: string, timezone: string) {
  return new Date(value).toLocaleString(undefined, {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`modal${wide ? ' modal-wide' : ''}`}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Empty({
  icon: Icon = FolderHeart,
  title,
  description,
  children,
}: {
  icon?: typeof Home;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [page, setPage] = useState<Page>('Home');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebar, setSidebar] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [detail, setDetail] = useState<Profile | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<'all' | Platform>('all');
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | 'unsupported'
  >('default');
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [online, setOnline] = useState(true);
  const activeUser = useRef<string | null>(null);
  const loadVersion = useRef(0);
  const loadRef = useRef<() => Promise<void>>(async () => {});
  const currentData = useRef(data);
  currentData.current = data;
  const notified = useRef(new Set<string>());
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const say = (text: string) => setToast(text);
  function navigate(value: Page) {
    setPage(value);
    setSidebar(false);
    setSearch('');
    setPlatform('all');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function load() {
    const version = ++loadVersion.current;
    if (!supabase) {
      setReady(true);
      return;
    }
    const {
      data: { user: account },
      error: authError,
    } = await supabase.auth.getUser();
    if (version !== loadVersion.current) return;
    if (authError || !account) {
      setUser(null);
      setData(emptyData());
      activeUser.current = null;
      setReady(true);
      return;
    }
    if (activeUser.current !== account.id) {
      activeUser.current = account.id;
      setData(emptyData());
      notified.current = new Set();
    }
    setUser(account);
    const results = await Promise.all(
      ['profiles', 'changes', 'reports', 'bookmarks', 'preferences'].map((table) =>
        supabase!.from(table).select('*').eq('user_id', account.id).limit(500),
      ),
    );
    const failed = results.find((result) => result.error);
    if (version !== loadVersion.current || activeUser.current !== account.id) return;
    if (failed) throw new Error('We couldn’t load your workspace. Please try refreshing.');
    if (!results[4].data?.length) {
      const { error } = await supabase
        .from('preferences')
        .upsert(
          { user_id: account.id, ...defaultPreferences },
          { onConflict: 'user_id', ignoreDuplicates: true },
        );
      if (error) throw new Error('We couldn’t save your preferences. Please retry.');
    }
    if (version !== loadVersion.current || activeUser.current !== account.id) return;
    setData({
      profiles: results[0].data || [],
      changes: (results[1].data || []).sort((a, b) => b.detected_at.localeCompare(a.detected_at)),
      reports: (results[2].data || []).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      bookmarks: (results[3].data || []).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      preferences: { ...defaultPreferences, ...results[4].data?.[0] },
    });
    setReady(true);
  }
  loadRef.current = load;
  useEffect(() => {
    // Retire the old demonstration workspace. Account data always comes from Supabase.
    localStorage.removeItem('social-lens-preview');
    const stored = localStorage.getItem('social-lens-theme');
    setTheme(stored === 'light' ? 'light' : 'dark');
    const media = window.matchMedia('(max-width: 850px)');
    const updateMobile = () => setMobile(media.matches);
    updateMobile();
    media.addEventListener('change', updateMobile);
    setStandalone(window.matchMedia('(display-mode: standalone)').matches);
    setOnline(navigator.onLine);
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    if ('Notification' in window) setNotificationPermission(Notification.permission);
    else setNotificationPermission('unsupported');
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setInstall(event as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    const installed = () => {
      setStandalone(true);
      setInstall(null);
    };
    window.addEventListener('appinstalled', installed);
    if ('serviceWorker' in navigator)
      navigator.serviceWorker
        .register(basePath + '/sw.js', { scope: basePath + '/' })
        .then((value) => {
          registration.current = value;
        })
        .catch(() => {});
    if (window.location.hash.includes('type=recovery')) setRecovery(true);
    loadRef.current().catch((e) => {
      say(e.message);
      setReady(true);
    });
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        setReady(true);
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')
        setTimeout(() => loadRef.current().catch((e) => say(e.message)), 0);
      if (event === 'SIGNED_OUT') {
        ++loadVersion.current;
        setUser(null);
        setData(emptyData());
        activeUser.current = null;
        setRecovery(false);
        setPage('Home');
        setReady(true);
      }
    });
    return () => {
      media.removeEventListener('change', updateMobile);
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('social-lens-theme', theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#080d18' : '#f4f6fb');
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setError('');
  }, [dialog, detail]);
  useEffect(() => {
    // A profile removed on another device must also disappear from its open viewer.
    setDetail((current) =>
      current ? data.profiles.find((p) => p.id === current.id) || null : null,
    );
  }, [data.profiles]);
  useEffect(() => {
    if (!user || !supabase) return;
    const channel = supabase
      .channel('workspace-' + user.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'changes', filter: 'user_id=eq.' + user.id },
        (event) => {
          const item = event.new as Change;
          if (notified.current.has(item.id)) return;
          notified.current.add(item.id);
          const prefs = currentData.current.preferences;
          const profile = currentData.current.profiles.find((p) => p.id === item.profile_id);
          loadRef.current().catch(() => {});
          if (
            !profile?.alerts ||
            prefs.digest_only ||
            inQuietHours(prefs.quiet_start, prefs.quiet_end, localClock(prefs.timezone).time)
          )
            return;
          say(item.title);
          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            registration.current
          )
            registration.current
              .showNotification('Social Lens', {
                body: item.title,
                icon: basePath + '/icons/icon-192.png',
                badge: basePath + '/icons/badge-96.png',
                tag: item.id,
                data: { url: basePath + '/' },
              })
              .catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports', filter: 'user_id=eq.' + user.id },
        () => {
          say('Your daily report is ready.');
          loadRef.current().catch(() => {});
        },
      )
      .subscribe();
    // Polling covers tables not published to Realtime, missed events, and deletions.
    let refreshing = false;
    const refresh = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || refreshing) return;
      refreshing = true;
      loadRef
        .current()
        .catch(() => {})
        .finally(() => {
          refreshing = false;
        });
    };
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      supabase!.removeChannel(channel);
    };
  }, [user?.id]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      const value =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e && 'message' in e
            ? String(e.message)
            : 'Something went wrong. Please try again.';
      setError(value);
      say(value);
    } finally {
      setBusy(false);
    }
  }
  const themeControl = (
    <button
      className="icon-button theme-button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? <Sun size={21} /> : <Moon size={21} />}
    </button>
  );
  async function allowNotifications() {
    await run(async () => {
      if (!('Notification' in window))
        throw new Error(
          'This browser does not support notifications. On iPhone, add Social Lens to your Home Screen first.',
        );
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      say(
        permission === 'granted'
          ? 'Browser alerts are enabled while Social Lens is open.'
          : permission === 'denied'
            ? 'Notifications are blocked. You can change this in your browser settings.'
            : 'You can enable notifications whenever you’re ready.',
      );
    });
  }
  async function installApp() {
    if (install) {
      await install.prompt();
      const choice = await install.userChoice;
      if (choice.outcome === 'accepted') setInstall(null);
    } else setDialog('install');
  }
  async function signOut() {
    await run(async () => {
      const { error } = await supabase!.auth.signOut();
      if (error) throw error;
      setData(emptyData());
      setUser(null);
      setDialog(null);
      setDetail(null);
      setReport(null);
    });
  }
  if (!ready)
    return (
      <div className="startup">
        <Logo />
        <Loader2 size={24} className="spin" />
        <p>Opening your workspace…</p>
      </div>
    );
  if (!user || recovery)
    return (
      <>
        <AuthScreen
          key={recovery ? 'recovery' : 'account'}
          recovery={recovery}
          onAuthenticated={async () => {
            setRecovery(false);
            await load();
          }}
          themeControl={themeControl}
        />
        {!online && (
          <div className="offline-note">
            <WifiOff size={16} />
            You’re offline. Connect to sign in.
          </div>
        )}
        {toast && (
          <div className="toast" role="status">
            <AlertCircle size={18} />
            <p>{toast}</p>
            <button onClick={() => setToast('')} aria-label="Dismiss message">
              <X size={18} />
            </button>
          </div>
        )}
      </>
    );
  const connected = data.profiles.filter((p) => p.kind === 'connected' && p.status !== 'paused');
  const saved = data.profiles.filter((p) => p.kind === 'saved');
  const unread = data.changes.filter((c) => !c.read).length;
  const newest = data.reports[0];
  const filteredProfiles = data.profiles.filter(
    (p) =>
      (page === 'Accounts' ? p.kind === 'connected' : p.kind === 'saved') &&
      (platform === 'all' || p.platform === platform) &&
      `${p.display_name} ${p.username}`.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredChanges = data.changes.filter(
    (c) =>
      (platform === 'all' || c.platform === platform) &&
      `${c.title} ${c.detail} ${c.username}`.toLowerCase().includes(search.toLowerCase()),
  );
  async function addProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await run(async () => {
      await clientAction('add-profile', {
        platform: f.get('platform'),
        username: f.get('username'),
      });
      await load();
      setDialog(null);
      navigate('Profiles');
      say('Profile added. Open it to view its public preview.');
    });
  }
  async function saveLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await run(async () => {
      await clientAction('bookmark', {
        url: f.get('url'),
        title: f.get('title'),
        collection: f.get('collection'),
      });
      await load();
      setDialog(null);
      say('Saved to your collection.');
    });
  }
  async function generateReport() {
    await run(async () => {
      const result = await clientAction('report');
      await load();
      if ('report' in result) setReport(result.report as Report);
      say('Your report is ready.');
    });
  }
  async function markRead(id?: string) {
    await run(async () => {
      await clientAction('mark-read', { id });
      await load();
    });
  }
  async function removeProfile() {
    if (!detail) return;
    await run(async () => {
      await clientAction('disconnect', { id: detail.id, deleteHistory: true });
      await load();
      setDetail(null);
      say('Profile removed from your workspace.');
    });
  }
  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    await run(async () => {
      const preferences: Preferences = {
        timezone: String(f.get('timezone')),
        report_time: String(f.get('report_time')),
        language: String(f.get('language')),
        report_length: f.get('report_length') as 'short' | 'detailed',
        email_enabled: f.has('email_enabled'),
        digest_only: f.has('digest_only'),
        quiet_start: String(f.get('quiet_start')),
        quiet_end: String(f.get('quiet_end')),
        retention_days: Number(f.get('retention_days')),
      };
      const { error } = await supabase!
        .from('preferences')
        .update(preferences)
        .eq('user_id', user!.id);
      if (error) throw error;
      await load();
      say('Preferences saved.');
    });
  }
  function exportReport(value: Report) {
    const text = `# ${value.title}\n${value.date}\n\n${value.summary}\n\nCoverage: ${value.coverage.success}/${value.coverage.total} successful checks.\n\n${value.items.map((c) => `- ${c.title}\n  ${c.detail}\n  Detected: ${c.detected_at}\n  Source: ${c.source_url}`).join('\n\n')}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `social-lens-${value.date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function Filters() {
    return (
      <div className="filters">
        <div className="segmented">
          {(['all', 'instagram', 'tiktok'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setPlatform(value)}
              aria-pressed={platform === value}
            >
              {value === 'all' ? 'All platforms' : label(value)}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Search this view"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
          />
        </label>
      </div>
    );
  }
  function ChangeRow({ item }: { item: Change }) {
    return (
      <article className={`change-row ${!item.read ? 'unread' : ''}`}>
        <span className="platform-mark">
          <PlatformIcon platform={item.platform} />
        </span>
        <div>
          <span className="change-meta">
            @{item.username} · {date(item.detected_at, data.preferences.timezone)}
          </span>
          <h3>
            <a href={item.source_url} target="_blank" rel="noreferrer">
              {item.title}
              <ArrowUpRight size={15} />
            </a>
          </h3>
          <p>{item.detail}</p>
          <span className="source-note">
            Detected from a successful account check
            {item.posted_at ? ` · Posted ${date(item.posted_at, data.preferences.timezone)}` : ''}
          </span>
        </div>
        {!item.read && (
          <button
            className="icon-button"
            onClick={() => markRead(item.id)}
            disabled={busy}
            aria-label={`Mark ${item.title} as read`}
          >
            <Check size={18} />
          </button>
        )}
      </article>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className={`sidebar ${sidebar ? 'open' : ''}`} inert={mobile && !sidebar}>
        <div className="sidebar-brand">
          <Logo />
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => setSidebar(false)}
          >
            <X size={21} />
          </button>
        </div>
        <div className="workspace-label">
          <span className="status-dot" />
          <span>Personal workspace</span>
          <ShieldCheck size={16} />
        </div>
        <nav aria-label="Main navigation">
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => navigate(name)}
              aria-current={page === name ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{name === 'Saved' ? 'Saved content' : name}</span>
              {name === 'Inbox' && unread > 0 && <b>{unread}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!standalone && (
            <button className="install-card" onClick={installApp}>
              <Smartphone size={22} />
              <span>
                <strong>Make it feel like home</strong>
                <small>Add Social Lens to your device</small>
              </span>
              <ChevronRight size={16} />
            </button>
          )}
          <button
            className="settings-nav"
            onClick={() => navigate('Settings')}
            aria-current={page === 'Settings' ? 'page' : undefined}
          >
            <Settings size={20} />
            Settings
          </button>
          <div className="sidebar-user">
            <span className="user-initial">{user.email?.[0].toUpperCase() || 'S'}</span>
            <span>
              <strong>Your workspace</strong>
              <small>{user.email}</small>
            </span>
            <button className="icon-button" onClick={signOut} aria-label="Sign out">
              <LogOut size={19} />
            </button>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-scrim"
          onClick={() => setSidebar(false)}
          aria-label="Close navigation"
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-only"
              onClick={() => setSidebar(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>
            <span className="breadcrumb">
              Workspace <ChevronRight size={14} />
              <strong>{page === 'Saved' ? 'Saved content' : page}</strong>
            </span>
          </div>
          <div className="top-actions">
            {!online && (
              <span className="offline-label">
                <WifiOff size={16} />
                Offline
              </span>
            )}
            {themeControl}
            <button
              className="icon-button inbox-button"
              onClick={() => navigate('Inbox')}
              aria-label={`Open inbox, ${unread} unread notifications`}
            >
              <Bell size={21} />
              {unread > 0 && <i />}
            </button>
            <button
              className="user-initial"
              onClick={() => navigate('Settings')}
              aria-label="Open settings"
            >
              {user.email?.[0].toUpperCase() || 'S'}
            </button>
          </div>
        </header>
        <main className="content" id="main">
          <div className="page-heading">
            <div>
              <span className="overline">YOUR PRIVATE WORKSPACE</span>
              <h1>
                {page === 'Home'
                  ? 'Welcome to your space.'
                  : page === 'Saved'
                    ? 'Saved content'
                    : page === 'Inbox'
                      ? 'Your inbox'
                      : page === 'Accounts'
                        ? 'Your accounts'
                        : page === 'Profiles'
                          ? 'Saved profiles'
                          : page}
              </h1>
              <p>
                {page === 'Home'
                  ? 'Just your accounts, your content, and what matters to you.'
                  : page === 'Accounts'
                    ? 'Connect only the accounts you own, through official authorization.'
                    : page === 'Profiles'
                      ? 'Your profiles and their available public content, in one place.'
                      : page === 'Reports'
                        ? 'A clear view of observed activity, with sources and coverage.'
                        : page === 'Inbox'
                          ? 'Account updates and useful alerts. No noise.'
                          : page === 'Saved'
                            ? 'Your links, ideas, and moments worth keeping.'
                            : 'A workspace that works the way you do.'}
              </p>
            </div>
            <div className="heading-actions">
              {page === 'Home' || page === 'Accounts' ? (
                <button className="primary" onClick={() => setDialog('connect')}>
                  <Plus size={18} />
                  Connect account
                </button>
              ) : page === 'Profiles' ? (
                <button className="primary" onClick={() => setDialog('profile')}>
                  <Plus size={18} />
                  Add profile
                </button>
              ) : page === 'Saved' ? (
                <button className="primary" onClick={() => setDialog('bookmark')}>
                  <Plus size={18} />
                  Save a link
                </button>
              ) : page === 'Reports' ? (
                <button
                  className="primary"
                  disabled={busy || !connected.length}
                  onClick={generateReport}
                >
                  <RefreshCw size={17} />
                  Generate report
                </button>
              ) : page === 'Inbox' ? (
                <button className="secondary" disabled={busy || !unread} onClick={() => markRead()}>
                  <CheckCheck size={17} />
                  Mark all read
                </button>
              ) : null}
            </div>
          </div>
          {page === 'Home' && (
            <>
              <section className="welcome-card">
                <div>
                  <span className="eyebrow-pill">
                    <Sparkles size={14} />
                    {connected.length ? 'Your daily perspective' : 'LET’S GET YOU STARTED'}
                  </span>
                  <h2>
                    {newest
                      ? 'Your latest briefing, ready when you are.'
                      : 'A fresh start. All yours.'}
                  </h2>
                  <p>
                    {newest
                      ? newest.summary
                      : 'Start by adding your own profile or saving your first link. Everything here is yours to choose.'}
                  </p>
                  <div className="welcome-actions">
                    <button
                      className="primary"
                      onClick={() => (newest ? setReport(newest) : setDialog('profile'))}
                    >
                      {newest ? 'Read latest report' : 'Add your first profile'}
                      <ArrowRight size={18} />
                    </button>
                    <button className="text-button" onClick={() => setDialog('bookmark')}>
                      Save a link <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="lens-art" aria-hidden="true">
                  <span />
                  <span />
                  <div>
                    <Logo compact />
                  </div>
                  <i>YOUR WORLD, IN FOCUS</i>
                </div>
              </section>
              <section className="stats-grid">
                {[
                  { title: 'Connected accounts', value: connected.length, icon: Link2 },
                  { title: 'Saved profiles', value: saved.length, icon: Users },
                  { title: 'Saved content', value: data.bookmarks.length, icon: Bookmark },
                  { title: 'Unread updates', value: unread, icon: Bell },
                ].map(({ title, value, icon: Icon }) => (
                  <button
                    className="stat-card"
                    key={title}
                    onClick={() =>
                      navigate(
                        title === 'Connected accounts'
                          ? 'Accounts'
                          : title === 'Saved profiles'
                            ? 'Profiles'
                            : title === 'Saved content'
                              ? 'Saved'
                              : 'Inbox',
                      )
                    }
                  >
                    <span>
                      {title}
                      <Icon size={19} />
                    </span>
                    <strong>{value}</strong>
                    <small>
                      {value === 0 ? 'Ready when you are' : 'In your workspace'}
                      <ArrowUpRight size={14} />
                    </small>
                  </button>
                ))}
              </section>
              <div className="home-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent activity</h2>
                      <p>Verified updates from your connected accounts.</p>
                    </div>
                    <button className="text-button" onClick={() => navigate('Inbox')}>
                      Open inbox <ArrowRight size={16} />
                    </button>
                  </div>
                  {data.changes.length ? (
                    data.changes.slice(0, 4).map((item) => <ChangeRow item={item} key={item.id} />)
                  ) : (
                    <Empty
                      icon={Bell}
                      title="Nothing to catch up on yet"
                      description="Updates from your connected accounts will appear here after successful checks."
                    />
                  )}
                </section>
                <aside className="home-side">
                  <section className="panel padded">
                    <span className="section-icon">
                      <ShieldCheck size={23} />
                    </span>
                    <h2>Private. Personal. Yours.</h2>
                    <p>
                      Your profile links, saved content, and settings are stored securely in your
                      account. Other users cannot see your workspace.
                    </p>
                    <button className="text-button" onClick={() => navigate('Settings')}>
                      Manage preferences <ArrowRight size={16} />
                    </button>
                  </section>
                  {notificationPermission !== 'granted' && (
                    <section className="panel padded">
                      <span className="section-icon">
                        <Bell size={23} />
                      </span>
                      <h2>A heads-up, when it matters.</h2>
                      <p>
                        Choose whether this device can show notifications while Social Lens is open.
                      </p>
                      <button
                        className="secondary full"
                        onClick={allowNotifications}
                        disabled={notificationPermission === 'unsupported'}
                      >
                        <Bell size={16} />
                        Enable browser alerts
                      </button>
                    </section>
                  )}
                </aside>
              </div>
            </>
          )}
          {(page === 'Accounts' || page === 'Profiles') && (
            <>
              <Filters />
              {page === 'Profiles' && (
                <div className="notice">
                  <Link2 size={20} />
                  <p>
                    Open a profile to see its public preview. Viewing a profile does not connect the
                    account or enable automatic monitoring.
                  </p>
                </div>
              )}
              <div className="profile-grid">
                {filteredProfiles.map((profile) => (
                  <article className="panel profile-card" key={profile.id}>
                    <div className="profile-top">
                      <span className={`platform-mark ${profile.platform}`}>
                        <PlatformIcon platform={profile.platform} size={24} />
                      </span>
                      <span
                        className={`status-badge ${profile.status === 'connected' ? 'positive' : ''}`}
                      >
                        {profile.kind === 'saved'
                          ? 'Public profile'
                          : profile.status.replaceAll('_', ' ')}
                      </span>
                    </div>
                    <h2>{profile.display_name}</h2>
                    <p>@{profile.username}</p>
                    <span className="profile-platform">{label(profile.platform)}</span>
                    {profile.bio && <p className="profile-bio">{profile.bio}</p>}
                    <div className="profile-information">
                      <span>
                        {profile.kind === 'saved'
                          ? 'Public content preview'
                          : profile.last_sync
                            ? 'Checked ' + date(profile.last_sync, data.preferences.timezone)
                            : 'No successful checks yet'}
                      </span>
                      {profile.last_sync_error && (
                        <span className="warning">
                          <AlertCircle size={16} />
                          {profile.last_sync_error}
                        </span>
                      )}
                    </div>
                    <SocialEmbed
                      {...profileEmbed(profile.platform, profile.username)}
                      title={`@${profile.username} public profile`}
                      compact
                    />
                    <button className="secondary full" onClick={() => setDetail(profile)}>
                      View profile <ArrowRight size={16} />
                    </button>
                  </article>
                ))}
              </div>
              {!filteredProfiles.length && (
                <section className="panel">
                  <Empty
                    icon={page === 'Accounts' ? Link2 : Users}
                    title={
                      search
                        ? 'No matches found'
                        : page === 'Accounts'
                          ? 'Your accounts belong here'
                          : 'Start with a profile you know'
                    }
                    description={
                      search
                        ? 'Try a different name or platform.'
                        : page === 'Accounts'
                          ? 'There are no connected accounts. Choose a platform to see its connection availability.'
                          : 'Add your Instagram or TikTok profile by username or profile URL.'
                    }
                  >
                    <button
                      className="primary"
                      onClick={() => setDialog(page === 'Accounts' ? 'connect' : 'profile')}
                    >
                      <Plus size={18} />
                      {page === 'Accounts' ? 'Connect account' : 'Add a profile'}
                    </button>
                  </Empty>
                </section>
              )}
            </>
          )}
          {page === 'Saved' && (
            <>
              <Filters />
              <div className="bookmark-grid">
                {data.bookmarks
                  .filter(
                    (item) =>
                      (platform === 'all' || item.platform === platform) &&
                      `${item.title} ${item.collection}`
                        .toLowerCase()
                        .includes(search.toLowerCase()),
                  )
                  .map((item) => (
                    <article className="panel bookmark-card" key={item.id}>
                      <div className="bookmark-cover">
                        <PlatformIcon platform={item.platform} size={30} />
                        <span>{label(item.platform)}</span>
                        <Bookmark size={44} />
                      </div>
                      <div className="bookmark-copy">
                        <span className="collection-label">{item.collection}</span>
                        <h2>{item.title}</h2>
                        <p>{date(item.created_at, data.preferences.timezone)}</p>
                        <div>
                          <a
                            className="text-button"
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open original <ArrowUpRight size={16} />
                          </a>
                          <button
                            className="icon-button"
                            aria-label={`Remove ${item.title}`}
                            onClick={() =>
                              run(async () => {
                                await clientAction('delete-bookmark', { id: item.id });
                                await load();
                                say('Saved link removed.');
                              })
                            }
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
              {!data.bookmarks.length && (
                <section className="panel">
                  <Empty
                    icon={Bookmark}
                    title="Keep something good"
                    description="Paste an Instagram or TikTok link. Your collection starts with the things you choose to save."
                  >
                    <button className="primary" onClick={() => setDialog('bookmark')}>
                      <Plus size={18} />
                      Save your first link
                    </button>
                  </Empty>
                </section>
              )}
            </>
          )}
          {page === 'Inbox' && (
            <>
              <Filters />
              <section className="panel">
                {filteredChanges.length ? (
                  filteredChanges.map((item) => <ChangeRow item={item} key={item.id} />)
                ) : (
                  <Empty
                    icon={Bell}
                    title="You’re all caught up"
                    description="There are no updates in your workspace. New verified activity will appear here when account monitoring becomes available."
                  />
                )}
              </section>
              <div className="notice">
                <ShieldCheck size={20} />
                <p>
                  Alerts always come from observed records. Failed checks are never reported as
                  “nothing happened.”
                </p>
              </div>
            </>
          )}
          {page === 'Reports' && (
            <>
              {data.reports.length ? (
                <div className="reports-list">
                  {data.reports.map((value) => (
                    <article className="panel report-card" key={value.id}>
                      <span className="section-icon">
                        <FileText size={24} />
                      </span>
                      <div>
                        <span className="collection-label">
                          {value.date} ·{' '}
                          {value.generated_by === 'ai' ? 'AI summary' : 'Observed record summary'}
                        </span>
                        <h2>{value.title}</h2>
                        <p>{value.summary}</p>
                        <span className="report-meta">
                          {value.coverage.success} of {value.coverage.total} accounts checked ·{' '}
                          {value.items.length} observed changes
                        </span>
                      </div>
                      <button className="secondary" onClick={() => setReport(value)}>
                        Read report <ArrowRight size={16} />
                      </button>
                    </article>
                  ))}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={FileText}
                    title="Your first report is ahead"
                    description="Reports bring together recorded activity from your connected accounts, with links back to each source."
                  >
                    <button className="secondary" onClick={() => navigate('Accounts')}>
                      View account setup <ArrowRight size={16} />
                    </button>
                  </Empty>
                </section>
              )}
              <div className="notice">
                <Clock size={20} />
                <p>
                  Your preferred daily report time is{' '}
                  <strong>{data.preferences.report_time}</strong> in {data.preferences.timezone}.
                  Scheduled reports require an active account monitoring service.
                </p>
                <button className="text-button" onClick={() => navigate('Settings')}>
                  Change schedule
                </button>
              </div>
            </>
          )}
          {page === 'Settings' && (
            <div className="settings-grid">
              <form
                className="panel settings-form"
                onSubmit={saveSettings}
                key={JSON.stringify(data.preferences)}
              >
                <div className="panel-heading">
                  <div>
                    <h2>Your daily rhythm</h2>
                    <p>Preferences sync across devices on this account. Save when you’re ready.</p>
                  </div>
                  <SlidersHorizontal size={22} />
                </div>
                <div className="form-grid">
                  <Field label="Timezone">
                    <select name="timezone" defaultValue={data.preferences.timezone}>
                      {[
                        'Asia/Baghdad',
                        'Asia/Dubai',
                        'Europe/London',
                        'Europe/Berlin',
                        'America/New_York',
                        'America/Los_Angeles',
                        'Asia/Kolkata',
                        'Asia/Tokyo',
                        'Australia/Sydney',
                        'UTC',
                      ].map((zone) => (
                        <option key={zone}>{zone}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Daily report time">
                    <input
                      type="time"
                      name="report_time"
                      required
                      defaultValue={data.preferences.report_time}
                    />
                  </Field>
                  <Field label="Report language">
                    <select name="language" defaultValue={data.preferences.language}>
                      <option>English</option>
                      <option>Arabic</option>
                      <option>Kurdish</option>
                    </select>
                  </Field>
                  <Field label="Report length">
                    <select name="report_length" defaultValue={data.preferences.report_length}>
                      <option value="short">Short and focused</option>
                      <option value="detailed">Detailed</option>
                    </select>
                  </Field>
                </div>
                <div className="form-divider">
                  <h3>Notification preferences</h3>
                  <label className="toggle-row">
                    <span>
                      <strong>Digest-only mode</strong>
                      <small>
                        Keep your activity in reports without individual browser alerts.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      name="digest_only"
                      defaultChecked={data.preferences.digest_only}
                    />
                  </label>
                  <label className="toggle-row">
                    <span>
                      <strong>Email my daily report</strong>
                      <small>
                        Preference saved now. Delivery requires an active email service.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      name="email_enabled"
                      defaultChecked={data.preferences.email_enabled}
                    />
                  </label>
                  <div className="form-grid">
                    <Field label="Quiet hours start">
                      <input
                        name="quiet_start"
                        type="time"
                        required
                        defaultValue={data.preferences.quiet_start}
                      />
                    </Field>
                    <Field label="Quiet hours end">
                      <input
                        name="quiet_end"
                        type="time"
                        required
                        defaultValue={data.preferences.quiet_end}
                      />
                    </Field>
                  </div>
                </div>
                <div className="form-divider">
                  <h3>Data retention</h3>
                  <Field label="Keep activity and reports for">
                    <select name="retention_days" defaultValue={data.preferences.retention_days}>
                      <option value="7">7 days</option>
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </Field>
                  <p className="helper">
                    Saved links stay until you remove them. Automated cleanup runs with the
                    monitoring service.
                  </p>
                </div>
                <button className="primary" disabled={busy}>
                  {busy ? <Loader2 size={18} className="spin" /> : <Check size={18} />}Save
                  preferences
                </button>
              </form>
              <aside className="settings-aside">
                <section className="panel padded">
                  <h2>Appearance</h2>
                  <p>Choose the look that’s easiest on your eyes.</p>
                  <div className="theme-options">
                    <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
                      <Moon size={18} />
                      Dark
                    </button>
                    <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
                      <Sun size={18} />
                      Light
                    </button>
                  </div>
                </section>
                <section className="panel padded">
                  <h2>This device</h2>
                  <p>
                    Browser notifications:{' '}
                    <strong>
                      {notificationPermission === 'granted'
                        ? 'Enabled'
                        : notificationPermission === 'denied'
                          ? 'Blocked'
                          : notificationPermission === 'unsupported'
                            ? 'Not supported'
                            : 'Not enabled'}
                    </strong>
                  </p>
                  <button
                    className="secondary full"
                    onClick={allowNotifications}
                    disabled={
                      notificationPermission === 'unsupported' ||
                      notificationPermission === 'granted'
                    }
                  >
                    <Bell size={17} />
                    Enable notifications
                  </button>
                  <p className="helper">
                    Alerts work while the app is open. Background push delivery is not configured
                    yet.
                  </p>
                  {!standalone && (
                    <button className="secondary full" onClick={installApp}>
                      <Download size={17} />
                      Add to your device
                    </button>
                  )}
                </section>
                <section className="panel padded">
                  <h2>Your account</h2>
                  <p className="account-email">{user.email}</p>
                  <button className="secondary full" onClick={signOut}>
                    <LogOut size={17} />
                    Sign out
                  </button>
                </section>
                <section className="panel padded danger-panel">
                  <h2>Delete account</h2>
                  <p>Permanently remove your workspace, saved links, reports, and preferences.</p>
                  <button className="danger-button" onClick={() => setDialog('delete')}>
                    Delete my account
                  </button>
                </section>
              </aside>
            </div>
          )}
          <footer className="app-footer">
            <Logo compact />
            <span>Your social world, in focus.</span>
            <span>
              <ShieldCheck size={14} />
              Personal by design
            </span>
          </footer>
        </main>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {[
            { name: 'Home' as Page, icon: Home },
            { name: 'Accounts' as Page, icon: Link2 },
            { name: 'Saved' as Page, icon: Bookmark },
            { name: 'Inbox' as Page, icon: Bell },
            { name: 'Settings' as Page, icon: Settings },
          ].map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => navigate(name)}
              aria-current={page === name ? 'page' : undefined}
            >
              <Icon size={21} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
      </div>
      {dialog && (
        <Modal
          title={
            dialog === 'connect'
              ? 'Connect your account'
              : dialog === 'profile'
                ? 'Add a profile'
                : dialog === 'bookmark'
                  ? 'Save something good'
                  : dialog === 'delete'
                    ? 'Delete your account?'
                    : 'Add Social Lens to your device'
          }
          onClose={() => setDialog(null)}
        >
          {dialog === 'connect' && (
            <>
              <p className="modal-intro">
                Your social password stays with the platform. Only official authorization can
                connect an account.
              </p>
              {(['instagram', 'tiktok'] as const).map((value) => (
                <div className="connection-option" key={value}>
                  <span className="platform-mark">
                    <PlatformIcon platform={value} size={23} />
                  </span>
                  <div>
                    <h3>{label(value)}</h3>
                    <p>{capabilities[value].eligibility}</p>
                    <span className="status-badge">
                      {socialConnectionsReady ? 'Ready to authorize' : 'Connection setup pending'}
                    </span>
                  </div>
                  <button
                    className="secondary"
                    disabled={busy || !socialConnectionsReady}
                    onClick={() =>
                      run(async () => {
                        await startSocialConnection(value);
                      })
                    }
                  >
                    Connect <ArrowRight size={16} />
                  </button>
                </div>
              ))}
              {!socialConnectionsReady && (
                <div className="notice">
                  <AlertCircle size={19} />
                  <p>
                    Live social connections aren’t available yet. Platform approval and secure
                    authorization setup are still required. You can save your own profile links now.
                  </p>
                </div>
              )}
              <button className="secondary full" onClick={() => setDialog('profile')}>
                <Plus size={17} />
                Save a profile link instead
              </button>
            </>
          )}
          {dialog === 'profile' && (
            <form onSubmit={addProfile}>
              <p className="modal-intro">
                Add an Instagram or TikTok username to view its available public profile preview.
                You can also save individual public posts inside the profile.
              </p>
              <Field label="Platform">
                <select name="platform">
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                </select>
              </Field>
              <Field label="Username or profile URL">
                <input
                  name="username"
                  required
                  maxLength={300}
                  placeholder="@yourname or a profile link"
                  autoComplete="off"
                />
              </Field>
              <button className="primary full" disabled={busy}>
                {busy ? <Loader2 size={18} className="spin" /> : <Plus size={18} />}Save profile
              </button>
            </form>
          )}
          {dialog === 'bookmark' && (
            <form onSubmit={saveLink}>
              <Field label="Instagram or TikTok link">
                <input name="url" type="url" placeholder="https://…" required />
              </Field>
              <Field label="Give it a title">
                <input
                  name="title"
                  required
                  maxLength={300}
                  placeholder="An idea I want to revisit"
                />
              </Field>
              <Field label="Collection">
                <input name="collection" required maxLength={80} defaultValue="Saved" />
              </Field>
              <button className="primary full" disabled={busy}>
                {busy ? <Loader2 size={18} className="spin" /> : <Bookmark size={18} />}Save link
              </button>
            </form>
          )}
          {dialog === 'delete' && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const confirmation = new FormData(event.currentTarget).get('confirm');
                run(async () => {
                  await clientAction('delete-account', { confirm: confirmation });
                  await supabase!.auth.signOut();
                  setData(emptyData());
                  setUser(null);
                  setDialog(null);
                  say('Your account and stored data have been deleted.');
                });
              }}
            >
              <p className="modal-intro">
                This permanently deletes your account and stored data. Previously delivered emails
                and notifications cannot be recalled.
              </p>
              <Field label="Type DELETE to confirm">
                <input
                  name="confirm"
                  required
                  pattern="DELETE"
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </Field>
              <button className="danger-button full" disabled={busy}>
                Permanently delete my account
              </button>
            </form>
          )}
          {dialog === 'install' && (
            <div className="install-instructions">
              <span className="install-logo">
                <Logo compact />
              </span>
              <p>Install Social Lens for its own app window, icon, and quick access.</p>
              <ol>
                <li>
                  <strong>iPhone / iPad:</strong> Open this site in Safari, tap Share, then Add to
                  Home Screen.
                </li>
                <li>
                  <strong>Android / Chrome:</strong> Open the browser menu and choose Install app or
                  Add to Home Screen.
                </li>
                <li>
                  <strong>Mac / Safari:</strong> Choose File → Add to Dock.
                </li>
                <li>
                  <strong>Desktop Chrome / Edge:</strong> Use the install icon in the address bar or
                  the browser’s install menu.
                </li>
              </ol>
              <p className="helper">
                Account access needs an internet connection. Installing the app doesn’t
                automatically enable notifications.
              </p>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              <AlertCircle size={17} />
              {error}
            </p>
          )}
        </Modal>
      )}
      {detail && (
        <Modal title={detail.display_name} onClose={() => setDetail(null)} wide>
          <div className="detail-heading">
            <span className="platform-mark">
              <PlatformIcon platform={detail.platform} size={25} />
            </span>
            <div>
              <h3>@{detail.username}</h3>
              <p>
                {label(detail.platform)} ·{' '}
                {detail.kind === 'saved' ? 'Public profile' : 'Connected account'}
              </p>
            </div>
          </div>
          <ProfileViewer
            key={detail.id}
            profile={detail}
            bookmarks={data.bookmarks}
            onSave={async (url, collection) => {
              await clientAction('bookmark', {
                url,
                collection,
                title: `@${detail.username} saved post`,
              });
              await load();
              say('Post saved. It will also appear on your other devices.');
            }}
          />
          <a
            className="secondary full"
            href={profileUrl(detail.platform, detail.username)}
            target="_blank"
            rel="noreferrer"
          >
            Open original profile <ExternalLink size={17} />
          </a>
          {detail.kind === 'saved' && (
            <button className="danger-button full" onClick={removeProfile} disabled={busy}>
              <Trash2 size={17} />
              Remove this saved profile
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
      {report && (
        <Modal title="Your report" onClose={() => setReport(null)}>
          <span className="collection-label">
            {report.date} · {report.generated_by === 'ai' ? 'AI summary' : 'Observed records'}
          </span>
          <h2 className="report-title">{report.title}</h2>
          <div className="notice">
            <ShieldCheck size={19} />
            <p>
              {report.coverage.success} of {report.coverage.total} accounts checked successfully.
              {report.coverage.failed > 0
                ? ' Some checks are incomplete; missing activity cannot be ruled out.'
                : ''}
            </p>
          </div>
          <p className="report-summary">{report.summary}</p>
          <h3 className="sources-heading">Source records</h3>
          {report.items.length ? (
            report.items.map((item) => <ChangeRow key={item.id} item={item} />)
          ) : (
            <p className="helper">
              No observed changes in this report. This does not confirm that nothing happened on
              accounts with incomplete coverage.
            </p>
          )}
          <button className="secondary full" onClick={() => exportReport(report)}>
            <Download size={17} />
            Export report
          </button>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <p>{toast}</p>
          <button onClick={() => setToast('')} aria-label="Dismiss message">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
