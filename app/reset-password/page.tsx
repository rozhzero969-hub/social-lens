'use client';
import { useEffect, useState, FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
export default function ResetPassword() {
  const [message, setMessage] = useState('');
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) setRecovery(true);
    const sub = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub?.data.subscription.unsubscribe();
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !recovery) {
      setMessage('Open the password recovery link from your email.');
      return;
    }
    const password = String(new FormData(e.currentTarget).get('password'));
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : 'Password updated. You can return to your workspace.');
  }
  return (
    <main style={{ maxWidth: 460, margin: '12vh auto', padding: 24 }}>
      <h1>A fresh start.</h1>
      <p className="dialog-description" style={{ marginTop: 15 }}>
        Choose a new password for your Social Lens workspace.
      </p>
      <form onSubmit={submit}>
        <label className="field">
          <span>New password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <button className="primary full" disabled={!recovery}>
          Update password
        </button>
      </form>
      <p role="status" className="form-help" style={{ marginTop: 15 }}>
        {message}
      </p>
      <a className="text-button" href="/">
        Return to your workspace →
      </a>
    </main>
  );
}
