'use client';
import { useEffect, useRef, useState, ReactNode, FormEvent } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Home,
  Camera as Instagram,
  Layers,
  Link2,
  Loader2,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
  Eye,
  Mail,
  RefreshCw,
  SlidersHorizontal,
  Menu,
  AlertCircle,
  Music2,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  AppData,
  Bookmark as BookmarkType,
  Change,
  defaultPreferences,
  emptyData,
  Platform,
  Preferences,
  Profile,
  Report,
} from '@/lib/types';
import { demoData } from '@/lib/demo';
import { capabilities, parseProfile, profileUrl, safeContentUrl } from '@/lib/platforms';
type Page =
  | 'Home'
  | 'My accounts'
  | 'Saved profiles'
  | 'Reports'
  | 'Notifications'
  | 'Saved content'
  | 'Settings';
type Modal = 'connect' | 'profile' | 'bookmark' | 'auth' | 'delete' | null;
const navigation: { name: Page; icon: typeof Home }[] = [
  { name: 'Home', icon: Home },
  { name: 'My accounts', icon: Link2 },
  { name: 'Saved profiles', icon: Users },
  { name: 'Reports', icon: FileText },
  { name: 'Notifications', icon: Bell },
  { name: 'Saved content', icon: Bookmark },
];
function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? 'small' : ''}`}>
      <span className="brand-mark">
        <span />
        <span />
        <span />
        <span />
      </span>
      {!small && (
        <>
          social<span className="brand-light">lens</span>
          <sup>●</sup>
        </>
      )}
    </span>
  );
}
function PlatformIcon({ platform, size = 17 }: { platform: Platform; size?: number }) {
  return platform === 'instagram' ? <Instagram size={size} /> : <Music2 size={size} />;
}
function PlatformPill({ platform }: { platform: Platform }) {
  return (
    <span className={`platform-icon ${platform}`}>
      <PlatformIcon platform={platform} />
    </span>
  );
}
function Avatar({ profile }: { profile: Profile }) {
  return (
    <span className={`avatar avatar-${profile.platform}`}>
      <span>
        {profile.display_name
          .split(/[ .]+/)
          .map((w) => w[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()}
      </span>
      <i>
        <PlatformIcon platform={profile.platform} size={11} />
      </i>
    </span>
  );
}
function relative(value: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 60
    ? `${minutes}m ago`
    : minutes < 1440
      ? `${Math.floor(minutes / 60)}h ago`
      : new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
function number(n: number | null) {
  return n === null
    ? '—'
    : Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
function Empty({
  icon: Icon = Layers,
  title,
  description,
  action,
}: {
  icon?: typeof Layers;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
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
  const [page, setPage] = useState<Page>('Home');
  const [data, setData] = useState<AppData>(emptyData);
  const [preview, setPreview] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [detail, setDetail] = useState<Profile | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [platform, setPlatform] = useState<'all' | Platform>('all');
  const [mobileNav, setMobileNav] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [dateRange, setDateRange] = useState('all');
  const loadedUser = useRef<string | null>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 650px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const notify = (message: string) => setToast(message);
  function go(p: Page) {
    setPage(p);
    setSearch('');
    setPlatform('all');
    setMobileNav(false);
  }
  async function load() {
    if (!supabase) return;
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    setUser(u);
    if (!u) return;
    setPreview(false);
    if (loadedUser.current !== u.id) {
      setData(emptyData());
      loadedUser.current = u.id;
    }
    const results = await Promise.all(
      ['profiles', 'changes', 'reports', 'bookmarks', 'preferences'].map((t) =>
        supabase!.from(t).select('*').eq('user_id', u.id),
      ),
    );
    const failed = results.find((r) => r.error);
    if (failed)
      throw new Error('Your data could not be loaded. Check the database connection and retry.');
    if (!results[4].data?.length) {
      const { error } = await supabase
        .from('preferences')
        .upsert(
          { user_id: u.id, ...defaultPreferences },
          { onConflict: 'user_id', ignoreDuplicates: true },
        );
      if (error) throw new Error('Report preferences could not be initialized. Please retry.');
    }
    setData({
      profiles: results[0].data || [],
      changes: (results[1].data || []).sort((a, b) => b.detected_at.localeCompare(a.detected_at)),
      reports: (results[2].data || []).sort((a, b) => b.date.localeCompare(a.date)),
      bookmarks: results[3].data || [],
      preferences: { ...defaultPreferences, ...results[4].data?.[0] },
    });
  }
  useEffect(() => {
    let cancelled = false;
    const saved = localStorage.getItem('social-lens-preview');
    try {
      setData(saved ? JSON.parse(saved) : demoData());
    } catch {
      setData(demoData());
    }
    load()
      .catch((e) => setToast(e.message))
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setTimeout(() => load().catch((e) => notify(e.message)), 0);
      if (event === 'SIGNED_OUT') {
        loadedUser.current = null;
        setUser(null);
        setPreview(true);
        setData(demoData());
      }
    });
    const q = new URLSearchParams(window.location.search);
    if (q.get('connection')) {
      notify(
        q.get('connection') === 'success'
          ? 'Account connected. Your first sync established a baseline.'
          : q.get('message') || 'Connection failed.',
      );
      history.replaceState({}, '', window.location.pathname);
    }
    return () => {
      cancelled = true;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (ready && preview) localStorage.setItem('social-lens-preview', JSON.stringify(data));
  }, [data, preview, ready]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setError('');
  }, [modal, detail]);
  async function api(action: string, payload: Record<string, unknown> = {}) {
    if (!supabase)
      throw new Error(
        'Supabase setup is required before live accounts can be used. The preview works locally.',
      );
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Sign in to use your live workspace.');
    const response = await fetch('/api/actions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed');
    if (result.warning) notify(result.warning);
    return result;
  }
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Something went wrong. Please try again.';
      setError(message);
      notify(message);
    } finally {
      setBusy(false);
    }
  }
  const unread = data.preferences.digest_only
    ? 0
    : data.changes.filter(
        (c) => !c.read && data.profiles.find((p) => p.id === c.profile_id)?.alerts,
      ).length;
  const connected = data.profiles.filter((p) => p.kind === 'connected');
  const saved = data.profiles.filter((p) => p.kind === 'saved');
  const matchingChanges = data.changes.filter(
    (c) =>
      (platform === 'all' || c.platform === platform) &&
      `${c.title} ${c.username} ${c.detail}`.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredProfiles = data.profiles.filter(
    (p) =>
      (page === 'My accounts' ? p.kind === 'connected' : p.kind === 'saved') &&
      (platform === 'all' || p.platform === platform) &&
      `${p.username} ${p.display_name}`.toLowerCase().includes(search.toLowerCase()),
  );
  function open(m: Modal) {
    setError('');
    setModal(m);
  }
  async function connect(p: Platform) {
    await run(async () => {
      if (preview) {
        notify('Sign in to connect a real account. Preview connections use sample data.');
        open('auth');
        return;
      }
      const {
        data: { session },
      } = await supabase!.auth.getSession();
      const response = await fetch(`/api/connect/${p}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const r = await response.json();
      if (!response.ok) throw new Error(r.error);
      window.location.assign(r.url);
    });
  }
  async function addProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run(async () => {
      const p = form.get('platform') as Platform;
      const username = parseProfile(String(form.get('username')), p);
      if (
        data.profiles.some((x) => x.kind === 'saved' && x.platform === p && x.username === username)
      )
        throw new Error('This profile is already saved.');
      if (preview)
        setData((d) => ({
          ...d,
          profiles: [
            ...d.profiles,
            {
              id: crypto.randomUUID(),
              platform: p,
              username,
              display_name: username,
              kind: 'saved',
              status: 'unsupported',
              last_sync: null,
              followers: null,
              bio: 'Saved profile link. Monitoring is not available for this profile.',
              alerts: false,
            },
          ],
        }));
      else {
        await api('add-profile', { platform: p, username });
        await load();
      }
      setModal(null);
      go('Saved profiles');
      notify(
        'Profile saved as a link. Monitoring is unavailable until platform access is verified.',
      );
    });
  }
  async function addBookmark(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run(async () => {
      const value = safeContentUrl(String(form.get('url')));
      const bookmark: BookmarkType = {
        id: crypto.randomUUID(),
        ...value,
        title: String(form.get('title')),
        collection: String(form.get('collection') || 'Inspiration'),
        created_at: new Date().toISOString(),
      };
      if (preview) setData((d) => ({ ...d, bookmarks: [bookmark, ...d.bookmarks] }));
      else {
        await api('bookmark', bookmark);
        await load();
      }
      setModal(null);
      notify('Added to your saved content.');
    });
  }
  async function auth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await run(async () => {
      if (!supabase)
        throw new Error(
          'Live sign-in is awaiting the Supabase project authorization. You can explore every screen in preview mode.',
        );
      const email = String(form.get('email'));
      const password = String(form.get('password'));
      if (authMode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
        notify('Check your email for a password reset link.');
        setModal(null);
        return;
      }
      const result =
        authMode === 'signup'
          ? await supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: window.location.origin },
            })
          : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (authMode === 'signup' && !result.data.session)
        notify('Check your email to confirm your account, then sign in.');
      else {
        await load();
        notify('Welcome to your workspace.');
      }
      setModal(null);
    });
  }
  async function markRead(id?: string) {
    await run(async () => {
      if (preview)
        setData((d) => ({
          ...d,
          changes: d.changes.map((c) => (!id || c.id === id ? { ...c, read: true } : c)),
        }));
      else {
        await api('mark-read', { id });
        await load();
      }
      notify(id ? 'Notification marked as read.' : 'All notifications marked as read.');
    });
  }
  async function createReport() {
    await run(async () => {
      if (preview) {
        const report: Report = {
          id: crypto.randomUUID(),
          title: 'Your daily social briefing',
          date: new Date().toISOString().slice(0, 10),
          summary:
            'Preview briefing: Studio North shared a new post and refreshed its bio. North in Motion published a video and gained 128 followers between successful sample checks. All activity in this workspace is illustrative.',
          coverage: { success: 2, total: 2, failed: 0 },
          items: data.changes,
          generated_by: 'template',
          created_at: new Date().toISOString(),
        };
        setData((d) => ({ ...d, reports: [report, ...d.reports] }));
        setSelectedReport(report);
      } else {
        const r = await api('report');
        await load();
        setSelectedReport(r.report);
      }
      notify('Your briefing is ready.');
    });
  }
  async function removeProfile(deleteHistory: boolean) {
    if (!detail) return;
    await run(async () => {
      if (preview) {
        setData((d) => ({
          ...d,
          profiles: deleteHistory
            ? d.profiles.filter((p) => p.id !== detail.id)
            : d.profiles.map((p) =>
                p.id === detail.id ? { ...p, status: 'paused', alerts: false } : p,
              ),
          changes: deleteHistory ? d.changes.filter((c) => c.profile_id !== detail.id) : d.changes,
          reports: deleteHistory
            ? d.reports.filter((r) => !r.items.some((c) => c.profile_id === detail.id))
            : d.reports,
        }));
      } else {
        await api('disconnect', { id: detail.id, deleteHistory });
        await load();
      }
      setDetail(null);
      notify(
        deleteHistory
          ? 'Profile and its collected history removed.'
          : 'Collection stopped. Permitted history was kept.',
      );
    });
  }
  async function savePreferences(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(async () => {
      const preferences: Preferences = {
        ...defaultPreferences,
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
      new Intl.DateTimeFormat('en', { timeZone: preferences.timezone });
      if (preview) setData((d) => ({ ...d, preferences }));
      else {
        const { error } = await supabase!
          .from('preferences')
          .update({ ...preferences, updated_at: new Date().toISOString() })
          .eq('user_id', user!.id);
        if (error) throw error;
        await load();
      }
      notify(
        preview ? 'Preview preferences saved on this device.' : 'Your preferences have been saved.',
      );
    });
  }
  function exportReport(r: Report) {
    const content = `# ${r.title}\n${r.date}\n\n${r.summary}\n\nCoverage: ${r.coverage.success}/${r.coverage.total} successful, ${r.coverage.failed} incomplete.\n${preview ? '\nPREVIEW — all data is illustrative.\n' : ''}\n${r.items.map((i) => `- ${i.title}\n  ${i.detail}\n  Detected: ${i.detected_at}\n  Posted: ${i.posted_at || 'Not applicable'}\n  Source: ${i.source_url}`).join('\n\n')}`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `social-lens-${r.date}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function ChangeRow({
    change: c,
    notification = false,
  }: {
    change: Change;
    notification?: boolean;
  }) {
    return (
      <div className={`change-row ${!c.read ? 'unread' : ''}`}>
        <div className={`event-icon ${c.kind}`}>
          {c.kind === 'post' ? (
            <Layers size={18} />
          ) : c.kind === 'metric' ? (
            <TrendingUp size={18} />
          ) : c.kind === 'bio' ? (
            <Users size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
        </div>
        <div className="change-copy">
          <div className="eyebrow">
            <PlatformIcon platform={c.platform} size={12} />
            <span>@{c.username}</span>
            <span>·</span>
            <span>{relative(c.detected_at)}</span>
          </div>
          <a href={c.source_url} target="_blank" rel="noreferrer" className="change-title">
            {c.title}
            <ArrowUpRight size={14} />
          </a>
          <p>{c.detail}</p>
          {notification && (
            <span className="reason">
              Why this appeared:{' '}
              {c.kind === 'post'
                ? 'a post was first observed after the baseline'
                : c.kind === 'metric'
                  ? 'a count changed between successful checks'
                  : 'a supported profile field changed'}
              . Detected {new Date(c.detected_at).toLocaleString()}
              {c.posted_at && ` · Posted ${new Date(c.posted_at).toLocaleString()}`}
            </span>
          )}
        </div>
        {notification && !c.read ? (
          <button
            className="icon-button"
            onClick={() => markRead(c.id)}
            aria-label={`Mark ${c.title} as read`}
          >
            <Check size={17} />
          </button>
        ) : (
          <span className={`event-label ${c.kind}`}>
            {c.kind === 'post'
              ? 'New post'
              : c.kind === 'metric'
                ? 'Growth'
                : c.kind === 'bio'
                  ? 'Profile update'
                  : 'Connection'}
          </span>
        )}
      </div>
    );
  }
  function Filters() {
    return (
      <div className="filters">
        <div className="segmented">
          {(['all', 'instagram', 'tiktok'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={platform === p ? 'active' : ''}
            >
              {p === 'all' ? (
                'All platforms'
              ) : (
                <>
                  <PlatformIcon platform={p} size={14} />
                  {capabilities[p].label}
                </>
              )}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input
            aria-label="Search this view"
            placeholder="Search anything…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </label>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside
        className={`sidebar ${mobileNav ? 'open' : ''}`}
        inert={isMobile && !mobileNav}
        aria-hidden={isMobile && !mobileNav ? true : undefined}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            className="mobile-only icon-button"
            aria-label="Close navigation"
            onClick={() => setMobileNav(false)}
          >
            <X />
          </button>
        </div>
        <button className="workspace" onClick={() => open('auth')}>
          <span className="workspace-avatar">R</span>
          <span>
            <strong>Personal workspace</strong>
            <small>{preview ? 'Explore Social Lens' : user?.email?.split('@')[0]}</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              onClick={() => go(name)}
              className={page === name ? 'selected' : ''}
              aria-current={page === name ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === 'Notifications' && unread > 0 && <b className="count">{unread}</b>}
              {name === 'Reports' && <span className="tiny-new">AI</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <div className="mini-orbit">
              <Activity size={20} />
            </div>
            <h4>
              Less scrolling.
              <br />
              More perspective.
            </h4>
            <p>Your social world, thoughtfully brought together.</p>
            <button onClick={() => go('Settings')}>
              Make it yours <ArrowRight size={14} />
            </button>
          </div>
          <button
            className={`settings-link ${page === 'Settings' ? 'selected' : ''}`}
            onClick={() => go('Settings')}
          >
            <Settings size={18} />
            Settings
          </button>
          <button
            className="user-button"
            onClick={() =>
              user
                ? run(async () => {
                    await supabase!.auth.signOut();
                    notify('You have signed out.');
                  })
                : open('auth')
            }
          >
            <span className="user-avatar">{user?.email?.[0].toUpperCase() || 'R'}</span>
            <span>
              <strong>{user?.email?.split('@')[0] || 'Your workspace'}</strong>
              <small>{user ? 'Sign out' : 'Sign in to get started'}</small>
            </span>
            {user ? <LogOut size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </aside>
      {mobileNav && (
        <button
          className="nav-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-only icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <Menu />
            </button>
            <Home size={15} />
            <span>/</span>
            <span>{page}</span>
          </div>
          <div className="topbar-actions">
            <span className="private-label">
              <ShieldCheck size={14} />
              Your space. Your data.
            </span>
            <button
              className="icon-button notification-button"
              aria-label="Open notifications"
              onClick={() => go('Notifications')}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </button>
            <button
              className="top-avatar"
              aria-label="Open account settings"
              onClick={() => go('Settings')}
            >
              {user?.email?.[0].toUpperCase() || 'R'}
            </button>
          </div>
        </header>
        {preview && (
          <div className="preview-bar">
            <span>
              <Eye size={14} />
              <strong>Preview workspace</strong>
              <span className="preview-explanation">
                {' '}
                — Sample activity. Changes stay on this device.
              </span>
            </span>
            <button onClick={() => open('auth')}>
              Start your workspace <ArrowRight size={13} />
            </button>
          </div>
        )}
        <main id="main" className="content">
          <div className="page-heading">
            <div>
              <div className="overline">YOUR SOCIAL WORLD, IN FOCUS</div>
              <h1>{page === 'Home' ? 'A little clarity. A lot less scrolling.' : page}</h1>
              <p>
                {page === 'Home'
                  ? 'Catch up on what matters, then get back to your day.'
                  : page === 'My accounts'
                    ? 'Your connections, permissions, and sync health.'
                    : page === 'Saved profiles'
                      ? 'Keep interesting people close. Know exactly what’s available.'
                      : page === 'Reports'
                        ? 'The important moments, thoughtfully brought together.'
                        : page === 'Notifications'
                          ? 'Useful updates, with the context behind every one.'
                          : page === 'Saved content'
                            ? 'A home for the things you want to come back to.'
                            : 'A quieter experience, shaped around you.'}
              </p>
            </div>
            <div className="heading-actions">
              {page === 'Home' ? (
                <>
                  <span className="date-label">
                    <Globe size={14} />
                    {new Date().toLocaleDateString('en', {
                      month: 'short',
                      day: 'numeric',
                      timeZone: data.preferences.timezone,
                    })}
                  </span>
                  <button className="primary" onClick={() => open('connect')}>
                    <Plus size={16} />
                    Connect account
                  </button>
                </>
              ) : page === 'My accounts' ? (
                <button className="primary" onClick={() => open('connect')}>
                  <Plus size={16} />
                  Connect account
                </button>
              ) : page === 'Saved profiles' ? (
                <button className="primary" onClick={() => open('profile')}>
                  <Plus size={16} />
                  Add profile
                </button>
              ) : page === 'Saved content' ? (
                <button className="primary" onClick={() => open('bookmark')}>
                  <Plus size={16} />
                  Save a link
                </button>
              ) : page === 'Reports' ? (
                <button className="primary" disabled={busy} onClick={createReport}>
                  {busy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}Generate
                  report
                </button>
              ) : page === 'Notifications' ? (
                <button className="secondary" onClick={() => markRead()} disabled={busy || !unread}>
                  <CheckCheck size={16} />
                  Mark all as read
                </button>
              ) : null}
            </div>
          </div>
          {!ready ? (
            <div className="loading">
              <Loader2 className="spin" />
              Getting your workspace ready…
            </div>
          ) : (
            <>
              {page === 'Home' && (
                <>
                  <section className="hero-card">
                    <div className="hero-main">
                      <span className="hero-kicker">
                        <span className="sparkle-icon">
                          <Sparkles size={14} />
                        </span>{' '}
                        YOUR DAILY PERSPECTIVE{' '}
                        <span className="hero-badge">
                          {preview
                            ? 'SAMPLE BRIEFING'
                            : data.reports.length
                              ? 'LATEST BRIEFING'
                              : 'GETTING STARTED'}
                        </span>
                      </span>
                      <h2>Your day, without the noise.</h2>
                      <p>
                        {data.reports[0]?.summary ||
                          'Connect your TikTok or Instagram account to turn verified updates into a clear daily briefing. Your first sync establishes a baseline.'}
                      </p>
                      <div className="hero-actions">
                        <button
                          onClick={() =>
                            data.reports[0] ? setSelectedReport(data.reports[0]) : open('connect')
                          }
                        >
                          {data.reports[0] ? 'Read your briefing' : 'Connect your first account'}
                          <ArrowRight size={16} />
                        </button>
                        <span>
                          <Clock size={13} />
                          Daily at {data.preferences.report_time} ·{' '}
                          {data.preferences.timezone.split('/').pop()?.replaceAll('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                      <div className="orbit orbit-three" />
                      <span className="floating insta">
                        <Instagram size={23} />
                      </span>
                      <span className="floating tiktok">
                        <Music2 size={22} />
                      </span>
                      <span className="floating star">
                        <Sparkles size={21} />
                      </span>
                      <div className="art-center">
                        <Brand small />
                      </div>
                      <div className="art-caption">
                        <span /> A clearer picture, every day
                      </div>
                    </div>
                  </section>
                  <section className="stats-grid" aria-label="Workspace overview">
                    {[
                      {
                        label: 'Connected accounts',
                        value: connected.length,
                        icon: Link2,
                        foot: `Across ${new Set(connected.map((p) => p.platform)).size} platforms`,
                        accent: 'green',
                      },
                      {
                        label: 'Saved profiles',
                        value: saved.length,
                        icon: Users,
                        foot: 'Your personal watchlist',
                        accent: 'blue',
                      },
                      {
                        label: 'Observed updates',
                        value: data.changes.length,
                        icon: Activity,
                        foot: preview ? 'In this sample workspace' : 'In retained history',
                        accent: 'orange',
                      },
                      {
                        label: 'Unread notifications',
                        value: unread,
                        icon: Bell,
                        foot: unread ? 'A few things to catch up on' : 'You’re all caught up',
                        accent: 'purple',
                      },
                    ].map(({ label, value, icon: Icon, foot, accent }) => (
                      <div className="stat-card" key={label}>
                        <div>
                          <span>{label}</span>
                          <span className={`stat-icon ${accent}`}>
                            <Icon size={17} />
                          </span>
                        </div>
                        <strong>{value.toString().padStart(2, '0')}</strong>
                        <p>{foot}</p>
                      </div>
                    ))}
                  </section>
                  <div className="home-grid">
                    <section className="panel activity-panel">
                      <div className="panel-heading">
                        <div>
                          <h2>What’s happening</h2>
                          <p>The updates that deserve a little attention.</p>
                        </div>
                        <button className="text-button" onClick={() => go('Notifications')}>
                          View all <ArrowRight size={14} />
                        </button>
                      </div>
                      <div className="activity-tabs">
                        <span className="active">
                          Recent activity <b>{data.changes.length}</b>
                        </span>
                        <span className="sample-label">
                          {preview ? 'Sample updates' : 'Observed updates'}
                        </span>
                      </div>
                      {data.changes.length ? (
                        data.changes.slice(0, 4).map((c) => <ChangeRow key={c.id} change={c} />)
                      ) : (
                        <Empty
                          title="Your story starts here"
                          description="Connect an account. After the baseline sync, verified changes will appear here."
                          action={
                            <button className="secondary" onClick={() => open('connect')}>
                              Connect an account <ArrowRight size={14} />
                            </button>
                          }
                        />
                      )}
                      <div className="panel-foot">
                        <ShieldCheck size={13} />
                        Every update has a source. Every summary stays grounded.
                      </div>
                    </section>
                    <aside className="right-column">
                      <section className="panel accounts-panel">
                        <div className="panel-heading">
                          <h2>
                            Your accounts <span className="subtle-count">{connected.length}</span>
                          </h2>
                          <button
                            className="icon-button"
                            aria-label="Manage accounts"
                            onClick={() => go('My accounts')}
                          >
                            <ArrowUpRight size={17} />
                          </button>
                        </div>
                        {connected.length ? (
                          connected.map((p) => (
                            <button
                              key={p.id}
                              className="account-mini"
                              onClick={() => setDetail(p)}
                            >
                              <Avatar profile={p} />
                              <span>
                                <strong>{p.display_name}</strong>
                                <small>@{p.username}</small>
                                <span
                                  className={`connection ${p.status === 'connected' ? 'healthy' : ''}`}
                                >
                                  <i />
                                  {p.status === 'connected'
                                    ? 'Connected'
                                    : p.status.replaceAll('_', ' ')}
                                </span>
                              </span>
                              <ChevronRight size={15} />
                            </button>
                          ))
                        ) : (
                          <p className="padded muted">No accounts connected yet.</p>
                        )}
                        <button className="add-account" onClick={() => open('connect')}>
                          <Plus size={15} />
                          Connect an account
                        </button>
                        <div className="connection-footer">
                          <span className="status-dot" />
                          {preview ? 'Sample connection status' : 'Approved permissions only'}
                        </div>
                      </section>
                      <section className="intention-card">
                        <div className="intention-icon">
                          <Bookmark size={20} />
                        </div>
                        <span className="overline">A LITTLE INSPIRATION</span>
                        <h3>
                          Good finds deserve
                          <br />a place to stay.
                        </h3>
                        <p>Save the posts, ideas, and moments you’ll want to revisit.</p>
                        <button onClick={() => go('Saved content')}>
                          Explore saved content <ArrowRight size={15} />
                        </button>
                      </section>
                    </aside>
                  </div>
                  <section className="trust-strip">
                    <span>
                      <ShieldCheck size={17} />
                      Built around your privacy
                    </span>
                    <p>Official connections. Clear permissions. Disconnect anytime.</p>
                    <button onClick={() => go('Settings')}>
                      You’re in control <ArrowRight size={14} />
                    </button>
                  </section>
                </>
              )}
              {(page === 'My accounts' || page === 'Saved profiles') && (
                <>
                  <Filters />
                  {page === 'Saved profiles' && (
                    <div className="notice">
                      <ShieldCheck size={18} />
                      <div>
                        <strong>A saved profile is a bookmark, until access is verified.</strong>
                        <p>
                          Username monitoring is currently unavailable. Saving a profile does not
                          connect it, verify its identity, or unlock private activity.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="profile-grid">
                    {filteredProfiles.map((p) => (
                      <article className="panel profile-card" key={p.id}>
                        <div className="profile-card-top">
                          <Avatar profile={p} />
                          <span
                            className={`status-badge ${p.status === 'connected' ? 'good' : ''}`}
                          >
                            {p.status === 'connected'
                              ? 'Connected'
                              : p.status === 'unsupported'
                                ? 'Link only'
                                : p.status.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <h3>{p.display_name}</h3>
                        <p>@{p.username}</p>
                        <div className="profile-platform">
                          <PlatformIcon platform={p.platform} size={14} />
                          {capabilities[p.platform].label}
                        </div>
                        <p className="profile-bio">
                          {p.bio ||
                            'Profile information will appear after the first successful sync.'}
                        </p>
                        <div className="profile-metrics">
                          <div>
                            <strong>{number(p.followers)}</strong>
                            <small>Followers</small>
                          </div>
                          <div>
                            <strong>
                              {data.changes.filter((c) => c.profile_id === p.id).length}
                            </strong>
                            <small>Observed updates</small>
                          </div>
                        </div>
                        <div className="profile-last">
                          <Clock size={13} />
                          {p.last_sync
                            ? `Last successful check ${relative(p.last_sync)}`
                            : 'No checks completed'}
                        </div>
                        {p.last_sync_error && (
                          <p className="sync-error">
                            <AlertCircle size={13} />
                            {p.last_sync_error}
                          </p>
                        )}
                        <button className="secondary full" onClick={() => setDetail(p)}>
                          View profile <ArrowRight size={14} />
                        </button>
                      </article>
                    ))}
                  </div>
                  {!filteredProfiles.length && (
                    <div className="panel">
                      <Empty
                        icon={Users}
                        title={
                          search
                            ? 'No matching profiles'
                            : page === 'My accounts'
                              ? 'Make your first connection'
                              : 'Keep a profile close'
                        }
                        description={
                          search
                            ? 'Try a different name or platform.'
                            : page === 'My accounts'
                              ? 'Connect your own account through its official authorization screen.'
                              : 'Save a TikTok or Instagram profile link. Available monitoring will always be clearly labeled.'
                        }
                        action={
                          <button
                            className="primary"
                            onClick={() => open(page === 'My accounts' ? 'connect' : 'profile')}
                          >
                            <Plus size={15} />
                            {page === 'My accounts' ? 'Connect account' : 'Add profile'}
                          </button>
                        }
                      />
                    </div>
                  )}
                </>
              )}
              {page === 'Reports' && (
                <>
                  <div className="reports-toolbar">
                    <span className="muted">
                      {data.reports.length} briefing{data.reports.length !== 1 ? 's' : ''} in your
                      library
                    </span>
                    <label className="inline-label">
                      Date range
                      <select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
                        <option value="all">All time</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                      </select>
                    </label>
                  </div>
                  <div className="report-list">
                    {data.reports
                      .filter(
                        (r) =>
                          dateRange === 'all' ||
                          new Date(r.date).getTime() >= Date.now() - Number(dateRange) * 86400000,
                      )
                      .map((r) => (
                        <article className="panel report-card" key={r.id}>
                          <div className="report-date">
                            <FileText size={21} />
                            <span>
                              {new Date(`${r.date}T12:00:00`).toLocaleDateString('en', {
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="report-copy">
                            <span className="eyebrow">
                              DAILY BRIEFING{' '}
                              <span className="generator">
                                {r.generated_by === 'ai' ? 'AI summary' : 'Verified record summary'}
                              </span>
                            </span>
                            <h2>{r.title}</h2>
                            <p>{r.summary}</p>
                            <div className="report-meta">
                              <span>
                                <ShieldCheck size={13} />
                                {r.coverage.success}/{r.coverage.total} accounts checked
                              </span>
                              <span>{r.items.length} observed updates</span>
                              {r.coverage.failed > 0 && (
                                <span className="warning">
                                  {r.coverage.failed} incomplete checks
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="report-buttons">
                            <button className="secondary" onClick={() => setSelectedReport(r)}>
                              Read briefing <ArrowRight size={14} />
                            </button>
                            <button
                              className="icon-button"
                              aria-label={`Export report for ${r.date}`}
                              onClick={() => exportReport(r)}
                            >
                              <ArrowDownToLine size={18} />
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                  {!data.reports.length && (
                    <div className="panel">
                      <Empty
                        icon={FileText}
                        title="Your first briefing is ahead"
                        description="Reports collect observed updates, show sync coverage, and link back to the facts."
                        action={
                          <button className="primary" onClick={createReport} disabled={busy}>
                            <Sparkles size={16} />
                            Generate a briefing
                          </button>
                        }
                      />
                    </div>
                  )}
                  <div className="notice">
                    <Clock size={18} />
                    <div>
                      <strong>On your schedule</strong>
                      <p>
                        Daily briefings are set for {data.preferences.report_time} in{' '}
                        {data.preferences.timezone}. Scheduled delivery needs the background worker
                        to be deployed and configured.
                      </p>
                    </div>
                    <button className="text-button" onClick={() => go('Settings')}>
                      Preferences <ArrowRight size={14} />
                    </button>
                  </div>
                </>
              )}
              {page === 'Notifications' && (
                <>
                  <Filters />
                  <div className="panel">
                    {matchingChanges.length ? (
                      matchingChanges.map((c) => <ChangeRow key={c.id} change={c} notification />)
                    ) : (
                      <Empty
                        icon={Bell}
                        title={search ? 'No matching updates' : 'A little peace and quiet'}
                        description={
                          search
                            ? 'Try a different search or platform.'
                            : 'Verified account changes will appear here, with an explanation and source.'
                        }
                      />
                    )}
                  </div>
                  <div className="notice">
                    <Bell size={18} />
                    <div>
                      <strong>Make room for what matters</strong>
                      <p>
                        Choose digest-only mode and quiet hours in Settings. Mute individual
                        accounts from their profile.
                      </p>
                    </div>
                  </div>
                </>
              )}
              {page === 'Saved content' && (
                <>
                  <Filters />
                  <div className="bookmark-grid">
                    {data.bookmarks
                      .filter(
                        (b) =>
                          (platform === 'all' || b.platform === platform) &&
                          `${b.title} ${b.collection}`.toLowerCase().includes(search.toLowerCase()),
                      )
                      .map((b, i) => (
                        <article className="panel bookmark-card" key={b.id}>
                          <div className={`bookmark-art art-${i % 3}`}>
                            <div className="bookmark-art-lines" />
                            <PlatformIcon platform={b.platform} size={34} />
                            <span>{b.collection}</span>
                          </div>
                          <div className="bookmark-content">
                            <div className="eyebrow">
                              <PlatformIcon platform={b.platform} size={13} />
                              {capabilities[b.platform].label}
                              <span>·</span>
                              {relative(b.created_at)}
                            </div>
                            <h3>{b.title}</h3>
                            <div className="bookmark-bottom">
                              <a
                                className="text-button"
                                href={b.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open original <ArrowUpRight size={14} />
                              </a>
                              <button
                                className="icon-button"
                                aria-label={`Remove ${b.title}`}
                                onClick={() =>
                                  run(async () => {
                                    if (preview)
                                      setData((d) => ({
                                        ...d,
                                        bookmarks: d.bookmarks.filter((x) => x.id !== b.id),
                                      }));
                                    else {
                                      await api('delete-bookmark', { id: b.id });
                                      await load();
                                    }
                                    notify('Bookmark removed.');
                                  })
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                  </div>
                  {!data.bookmarks.length && (
                    <div className="panel">
                      <Empty
                        icon={Bookmark}
                        title="A little collection of good things"
                        description="Save links to posts and videos. Originals stay on Instagram and TikTok."
                        action={
                          <button className="primary" onClick={() => open('bookmark')}>
                            <Plus size={15} />
                            Save your first link
                          </button>
                        }
                      />
                    </div>
                  )}
                </>
              )}
              {page === 'Settings' && (
                <div className="settings-grid">
                  <form
                    className="panel preferences-form"
                    key={JSON.stringify(data.preferences)}
                    onSubmit={savePreferences}
                  >
                    <div className="panel-heading">
                      <div>
                        <h2>Your daily rhythm</h2>
                        <p>A briefing that fits your day.</p>
                      </div>
                      <Clock size={20} />
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
                          ].map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Daily report time">
                        <input
                          name="report_time"
                          type="time"
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
                          <option value="short">Short & focused</option>
                          <option value="detailed">Detailed</option>
                        </select>
                      </Field>
                    </div>
                    <div className="form-section">
                      <h3>Notifications, with intention</h3>
                      <label className="toggle-row">
                        <span>
                          <strong>Email my daily briefing</strong>
                          <small>
                            Requires configured email delivery. In-app reports are always available.
                          </small>
                        </span>
                        <input
                          name="email_enabled"
                          type="checkbox"
                          defaultChecked={data.preferences.email_enabled}
                        />
                      </label>
                      <label className="toggle-row">
                        <span>
                          <strong>Digest-only mode</strong>
                          <small>
                            Read your updates together in reports. Hide individual alert badges.
                          </small>
                        </span>
                        <input
                          name="digest_only"
                          type="checkbox"
                          defaultChecked={data.preferences.digest_only}
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
                    <div className="form-section">
                      <h3>Keep only what you need</h3>
                      <Field label="Activity and report retention">
                        <select
                          name="retention_days"
                          defaultValue={data.preferences.retention_days}
                        >
                          <option value="7">7 days</option>
                          <option value="30">30 days</option>
                          <option value="90">90 days</option>
                          <option value="365">1 year</option>
                        </select>
                      </Field>
                      <p className="form-help">
                        The worker removes older activity and reports. Platform requirements may
                        require earlier deletion. Bookmarks stay until you remove them.
                      </p>
                    </div>
                    <button className="primary" disabled={busy}>
                      {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}Save
                      preferences
                    </button>
                  </form>
                  <aside className="settings-aside">
                    <section className="panel padded">
                      <span className="settings-shield">
                        <ShieldCheck size={25} />
                      </span>
                      <h3>You’re in control.</h3>
                      <p className="muted">
                        Your social passwords never enter this app. Approved access can be
                        disconnected from each account’s profile.
                      </p>
                      <button className="secondary full" onClick={() => go('My accounts')}>
                        Manage connections <ArrowRight size={14} />
                      </button>
                    </section>
                    <section className="panel padded">
                      <h3>Workspace</h3>
                      <p className="muted">
                        {preview
                          ? 'You are exploring sample data stored on this device.'
                          : `Signed in as ${user?.email}`}
                      </p>
                      {preview ? (
                        <button
                          className="secondary full"
                          onClick={() => {
                            setData(demoData());
                            notify('The preview workspace was reset.');
                          }}
                        >
                          Reset preview
                        </button>
                      ) : (
                        <button
                          className="secondary full"
                          onClick={() =>
                            run(async () => {
                              await supabase!.auth.signOut();
                            })
                          }
                        >
                          <LogOut size={15} />
                          Sign out
                        </button>
                      )}
                    </section>
                    <section className="panel padded danger-panel">
                      <h3>Delete workspace</h3>
                      <p>
                        Delete your account, connections, reports, preferences and saved content.
                        Previously delivered emails cannot be recalled.
                      </p>
                      <button className="danger-button" onClick={() => open('delete')}>
                        {preview ? 'Clear preview data' : 'Delete my account'}
                      </button>
                    </section>
                  </aside>
                </div>
              )}
            </>
          )}
          <footer className="app-footer">
            <Brand small />
            <span>A little more perspective.</span>
            <span className="footer-right">TikTok & Instagram · Privacy by design</span>
          </footer>
        </main>
        <nav className="mobile-bottom" aria-label="Mobile navigation">
          {[
            { name: 'Home' as Page, icon: Home },
            { name: 'Saved profiles' as Page, icon: Users },
            { name: 'Reports' as Page, icon: FileText },
            { name: 'Notifications' as Page, icon: Bell },
          ].map(({ name, icon: Icon }) => (
            <button key={name} onClick={() => go(name)} className={page === name ? 'active' : ''}>
              <Icon size={20} />
              <span>{name === 'Saved profiles' ? 'Profiles' : name}</span>
            </button>
          ))}
        </nav>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>
            <Check size={17} />
          </span>
          <p>{toast}</p>
          <button aria-label="Dismiss message" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {modal && (
        <Dialog
          title={
            modal === 'connect'
              ? 'Bring your accounts together'
              : modal === 'profile'
                ? 'Save a profile'
                : modal === 'bookmark'
                  ? 'Keep a good find'
                  : modal === 'auth'
                    ? authMode === 'signup'
                      ? 'Make room for clarity'
                      : authMode === 'reset'
                        ? 'Reset your password'
                        : 'Welcome to Social Lens'
                    : preview
                      ? 'Clear preview data?'
                      : 'Delete your account?'
          }
          onClose={() => setModal(null)}
        >
          {modal === 'connect' && (
            <>
              <p className="dialog-description">
                Choose a platform. You’ll authorize on its official screen and see exactly what’s
                shared.
              </p>
              {(['instagram', 'tiktok'] as const).map((p) => (
                <button
                  className="platform-option"
                  key={p}
                  disabled={busy}
                  onClick={() => connect(p)}
                >
                  <PlatformPill platform={p} />
                  <span>
                    <strong>{capabilities[p].label}</strong>
                    <small>{capabilities[p].eligibility}</small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))}
              <div className="notice compact">
                <ShieldCheck size={17} />
                <p>
                  We never ask for your social password. Connections require developer setup and
                  platform approval. Public-profile tracking stays disabled until verified.
                </p>
              </div>
            </>
          )}
          {modal === 'profile' && (
            <form onSubmit={addProfile}>
              <p className="dialog-description">
                Save an Instagram or TikTok profile by username or link. Monitoring is not available
                yet.
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
                  placeholder="@username or https://…"
                  required
                  maxLength={300}
                />
              </Field>
              <p className="form-help">
                This saves a link. We cannot confirm the profile’s identity or retrieve its updates
                without supported access.
              </p>
              <button className="primary full" disabled={busy}>
                <Plus size={16} />
                Save profile
              </button>
            </form>
          )}
          {modal === 'bookmark' && (
            <form onSubmit={addBookmark}>
              <p className="dialog-description">
                Save the original link and give it a name you’ll remember.
              </p>
              <Field label="Post or video URL">
                <input type="url" name="url" placeholder="https://www.instagram.com/p/…" required />
              </Field>
              <Field label="Title">
                <input
                  name="title"
                  placeholder="Something worth coming back to"
                  required
                  maxLength={300}
                />
              </Field>
              <Field label="Collection">
                <input name="collection" defaultValue="Inspiration" required maxLength={80} />
              </Field>
              <button className="primary full" disabled={busy}>
                <Bookmark size={16} />
                Save link
              </button>
            </form>
          )}
          {modal === 'auth' && (
            <form onSubmit={auth}>
              <p className="dialog-description">
                {authMode === 'signup'
                  ? 'Create your personal workspace. Start with what matters to you.'
                  : authMode === 'reset'
                    ? 'We’ll email you a secure link to choose a new password.'
                    : 'A quieter place for your social world.'}
              </p>
              <Field label="Email address">
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                />
              </Field>
              {authMode !== 'reset' && (
                <Field label="Password">
                  <input
                    name="password"
                    type="password"
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    minLength={8}
                    required
                    placeholder="At least 8 characters"
                  />
                </Field>
              )}
              <button className="primary full" disabled={busy}>
                {busy ? <Loader2 className="spin" size={16} /> : <ArrowRight size={16} />}{' '}
                {authMode === 'signup'
                  ? 'Create workspace'
                  : authMode === 'reset'
                    ? 'Send reset link'
                    : 'Sign in'}
              </button>
              <div className="auth-options">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}
                >
                  {authMode === 'signup'
                    ? 'Already have an account? Sign in'
                    : 'New here? Create an account'}
                </button>
                {authMode === 'login' && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setAuthMode('reset')}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <p className="form-help">
                {supabase
                  ? 'Your workspace data is protected by per-user access policies.'
                  : 'Live sign-in is awaiting Supabase project authorization. The preview is available without an account.'}
              </p>
            </form>
          )}
          {modal === 'delete' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const value = new FormData(e.currentTarget).get('confirm');
                run(async () => {
                  if (value !== 'DELETE') throw new Error('Type DELETE to confirm.');
                  if (preview) {
                    localStorage.removeItem('social-lens-preview');
                    setData(emptyData());
                  } else {
                    await api('delete-account', { confirm: value });
                    await supabase!.auth.signOut();
                    setData(emptyData());
                  }
                  setModal(null);
                  notify(
                    preview
                      ? 'Preview data cleared.'
                      : 'Your account and stored data have been deleted.',
                  );
                });
              }}
            >
              <p className="dialog-description">
                {preview
                  ? 'This removes the sample data saved on this device. You can restore it using Reset preview in Settings.'
                  : 'This permanently removes your workspace and stops collection. Remove Social Lens from platform settings if revocation fails. Delivered emails cannot be recalled.'}
              </p>
              <Field label="Type DELETE to confirm">
                <input name="confirm" required pattern="DELETE" placeholder="DELETE" />
              </Field>
              <button className="danger-button full" disabled={busy}>
                {preview ? 'Clear preview data' : 'Permanently delete account'}
              </button>
            </form>
          )}
          {error && (
            <p className="form-error" role="alert">
              <AlertCircle size={16} />
              {error}
            </p>
          )}
        </Dialog>
      )}
      {detail && (
        <Dialog title={detail.display_name} onClose={() => setDetail(null)}>
          <div className="detail-heading">
            <Avatar profile={detail} />
            <div>
              <strong>@{detail.username}</strong>
              <p>
                {capabilities[detail.platform].label} ·{' '}
                {detail.kind === 'connected'
                  ? 'Your connected account'
                  : 'Saved public profile link'}
              </p>
            </div>
          </div>
          <p className="dialog-description">{detail.bio || 'No profile data collected yet.'}</p>
          <div className="detail-facts">
            {detail.last_sync_error && (
              <span className="sync-error">
                <strong>Latest check failed</strong>
                {detail.last_sync_error} Previous data has been preserved.
              </span>
            )}
            <span>
              <strong>Last successful check</strong>
              {detail.last_sync
                ? new Date(detail.last_sync).toLocaleString()
                : 'No checks completed'}
            </span>
            <span>
              <strong>Access</strong>
              {detail.kind === 'saved'
                ? 'Bookmark only. Monitoring unavailable.'
                : 'Approved profile, posts and available counts.'}
            </span>
            <span>
              <strong>Unsupported</strong>Private activity, follower identities, stories and
              watermark-free downloads.
            </span>
          </div>
          <a
            className="secondary full"
            href={profileUrl(detail.platform, detail.username)}
            target="_blank"
            rel="noreferrer"
          >
            Open original profile <ExternalLink size={15} />
          </a>
          {detail.kind === 'connected' && detail.status === 'connected' && (
            <div className="detail-controls">
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (preview) {
                      notify('Preview refreshed. No real platform requests were made.');
                      return;
                    }
                    await api('sync', { id: detail.id });
                    await load();
                    notify('Account checked successfully.');
                  })
                }
              >
                <RefreshCw size={15} />
                Check for updates
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (preview)
                      setData((d) => ({
                        ...d,
                        profiles: d.profiles.map((p) =>
                          p.id === detail.id ? { ...p, alerts: !detail.alerts } : p,
                        ),
                      }));
                    else {
                      await api('alerts', { id: detail.id, enabled: !detail.alerts });
                      await load();
                    }
                    setDetail({ ...detail, alerts: !detail.alerts });
                    notify(detail.alerts ? 'Account muted.' : 'Account alerts enabled.');
                  })
                }
              >
                <Bell size={15} />
                {detail.alerts ? 'Mute alerts' : 'Enable alerts'}
              </button>
            </div>
          )}
          <div className="disconnect-zone">
            <h3>{detail.kind === 'saved' ? 'Remove this profile' : 'Disconnect anytime'}</h3>
            <p>
              Stop collection and alerts. Choose whether to keep permitted history. Delivered emails
              cannot be recalled.
            </p>
            <div className="detail-controls">
              <button className="secondary" disabled={busy} onClick={() => removeProfile(false)}>
                Stop & keep history
              </button>
              <button className="danger-button" disabled={busy} onClick={() => removeProfile(true)}>
                Remove & delete history
              </button>
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {selectedReport && (
        <Dialog title="Your daily perspective" onClose={() => setSelectedReport(null)}>
          <span className="report-modal-date">
            {selectedReport.date} ·{' '}
            {selectedReport.generated_by === 'ai'
              ? 'AI-generated from observed records'
              : 'Summary from verified records'}
            {preview ? ' · Preview' : ''}
          </span>
          <h2 className="report-modal-title">{selectedReport.title}</h2>
          <div className="report-coverage">
            <ShieldCheck size={18} />
            <span>
              <strong>
                {selectedReport.coverage.success} of {selectedReport.coverage.total} accounts
                checked successfully
              </strong>
              <small>
                {selectedReport.coverage.failed
                  ? `${selectedReport.coverage.failed} incomplete checks. Missing activity cannot be ruled out.`
                  : 'Coverage reflects recent successful checks. Saved profile links are not monitored.'}
              </small>
            </span>
          </div>
          <p className="report-summary">{selectedReport.summary}</p>
          <h3 className="report-sources-title">Observed updates & sources</h3>
          {selectedReport.items.length ? (
            selectedReport.items.map((c) => <ChangeRow key={c.id} change={c} notification />)
          ) : (
            <p className="muted">
              No verified changes in this reporting window. This does not imply nothing happened on
              accounts with incomplete coverage.
            </p>
          )}
          <button className="secondary full" onClick={() => exportReport(selectedReport)}>
            <ArrowDownToLine size={16} />
            Export briefing
          </button>
        </Dialog>
      )}
    </div>
  );
}
