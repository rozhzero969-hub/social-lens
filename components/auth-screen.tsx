'use client';
import { FormEvent, useState } from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Link2,
  FileText,
  Bell,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Logo from './logo';
export default function AuthScreen({
  onAuthenticated,
  themeControl,
  recovery = false,
}: {
  onAuthenticated: () => Promise<void>;
  themeControl: React.ReactNode;
  recovery?: boolean;
}) {
  const [mode, setMode] = useState<'login' | 'signup' | 'reset' | 'recovery'>(
    recovery ? 'recovery' : 'signup',
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (!supabase)
        throw new Error('Account service is temporarily unavailable. Please try again shortly.');
      const email = String(form.get('email') || '');
      const password = String(form.get('password') || '');
      const redirect = window.location.origin + window.location.pathname;
      if (mode === 'recovery') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage('Password updated. Sign in with your new password.');
        await supabase.auth.signOut();
        setMode('login');
        return;
      }
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirect,
        });
        if (error) throw error;
        setMessage('If an account exists for this address, you’ll receive a password reset link.');
        return;
      }
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage('Check your email to confirm your account, then return here to sign in.');
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await onAuthenticated();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not complete this request. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }
  function switchMode(value: typeof mode) {
    setMode(value);
    setError('');
    setMessage('');
  }
  return (
    <div className="auth-page">
      <header className="auth-header">
        <Logo />
        {themeControl}
      </header>
      <main className="auth-layout">
        <section className="auth-intro">
          <span className="eyebrow-pill">
            <Sparkles size={14} />A clearer view of your social world
          </span>
          <h1>
            <span className="desktop-title">
              Your accounts.
              <br />
              Your space.
              <br />
              <em>Nothing extra.</em>
            </span>
            <span className="mobile-title">
              Your own <em>social space.</em>
            </span>
          </h1>
          <p>
            A private home for your TikTok, Instagram and Snapchat profiles, saved content, and
            daily perspective.
          </p>
          <div className="auth-benefits">
            {[
              {
                icon: Link2,
                title: 'Start with your own profiles',
                text: 'A private workspace with the profiles you choose.',
              },
              {
                icon: FileText,
                title: 'Keep the things that matter',
                text: 'Save links and organize your social content in one place.',
              },
              {
                icon: Bell,
                title: 'Stay informed, on your terms',
                text: 'Control alerts, quiet hours, and your daily report schedule.',
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <span>
                  <Icon size={20} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="auth-privacy">
            <ShieldCheck size={18} />
            <span>Private by default. Your data belongs to you.</span>
          </div>
        </section>
        <section className="auth-card" aria-label="Account access">
          <span className="auth-icon">
            <LockKeyhole size={23} />
          </span>
          <h2>
            {mode === 'signup'
              ? 'Make it yours.'
              : mode === 'login'
                ? 'Welcome back.'
                : mode === 'recovery'
                  ? 'Choose a new password.'
                  : 'Forgot your password?'}
          </h2>
          <p>
            {mode === 'signup'
              ? 'Create an account to open your personal workspace.'
              : mode === 'login'
                ? 'Sign in to your own accounts and saved content.'
                : mode === 'recovery'
                  ? 'Use at least 8 characters.'
                  : 'We’ll send you a secure reset link.'}
          </p>
          {(mode === 'signup' || mode === 'login') && (
            <div className="auth-tabs">
              <button onClick={() => switchMode('signup')} aria-pressed={mode === 'signup'}>
                Create account
              </button>
              <button onClick={() => switchMode('login')} aria-pressed={mode === 'login'}>
                Sign in
              </button>
            </div>
          )}
          <form onSubmit={submit}>
            {mode !== 'recovery' && (
              <label className="field">
                <span>Email address</span>
                <span className="input-with-icon">
                  <Mail size={18} />
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    maxLength={254}
                  />
                </span>
              </label>
            )}
            {mode !== 'reset' && (
              <label className="field">
                <span>{mode === 'recovery' ? 'New password' : 'Password'}</span>
                <span className="input-with-icon">
                  <LockKeyhole size={18} />
                  <input
                    name="password"
                    type={visible ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={8}
                    placeholder="At least 8 characters"
                    required
                    maxLength={128}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
            )}
            {mode === 'login' && (
              <button type="button" className="auth-forgot" onClick={() => switchMode('reset')}>
                Forgot password?
              </button>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="form-success" role="status">
                <CheckCircle2 size={18} />
                {message}
              </p>
            )}
            <button className="primary full" disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : <ArrowRight size={18} />}{' '}
              {mode === 'signup'
                ? 'Create my account'
                : mode === 'login'
                  ? 'Sign in'
                  : mode === 'recovery'
                    ? 'Save new password'
                    : 'Send reset link'}
            </button>
            {mode === 'reset' && (
              <button
                type="button"
                className="text-button full"
                onClick={() => switchMode('login')}
              >
                Back to sign in
              </button>
            )}
          </form>
          <div className="auth-note">
            <ShieldCheck size={15} />
            <p>
              Creating a Social Lens account does not connect your social accounts. You choose what
              to add after signing in.
            </p>
          </div>
        </section>
      </main>
      <footer className="auth-footer">Social Lens · Your social world, in focus</footer>
    </div>
  );
}
