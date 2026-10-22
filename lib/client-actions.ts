import { supabase } from './supabase';
import { parseProfile, safeContentUrl } from './platforms';
import type { Platform } from './types';
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
export const socialConnectionsReady = Boolean(apiBase);
export async function clientAction(action: string, payload: Record<string, unknown> = {}) {
  if (!supabase) throw new Error('Account service is not configured. Please try again later.');
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Your session has expired. Please sign in again.');
  const db = supabase;
  let result: { data?: unknown; error: unknown };
  switch (action) {
    case 'add-profile': {
      const platform = payload.platform as Platform;
      if (!['instagram', 'tiktok'].includes(platform))
        throw new Error('Choose a supported platform.');
      const username = parseProfile(String(payload.username || ''), platform);
      result = await db.from('profiles').insert({
        user_id: user.id,
        platform,
        username,
        display_name: username,
        kind: 'saved',
        status: 'unsupported',
        alerts: false,
      });
      break;
    }
    case 'bookmark': {
      const link = safeContentUrl(String(payload.url));
      result = await db.from('bookmarks').insert({
        user_id: user.id,
        ...link,
        title: String(payload.title || 'Saved link').slice(0, 300),
        collection: String(payload.collection || 'Saved').slice(0, 80),
      });
      break;
    }
    case 'delete-bookmark':
      result = await db.from('bookmarks').delete().eq('user_id', user.id).eq('id', payload.id);
      break;
    case 'mark-read': {
      let query = db.from('changes').update({ read: true }).eq('user_id', user.id);
      if (payload.id) query = query.eq('id', payload.id);
      result = await query;
      break;
    }
    case 'report':
      result = await db.rpc('create_my_report');
      if (result.error) throw result.error;
      return { report: result.data };
    case 'disconnect': {
      result = await db.rpc('remove_my_saved_profile', {
        profile: payload.id,
        delete_history: Boolean(payload.deleteHistory),
      });
      break;
    }
    case 'delete-account': {
      if (payload.confirm !== 'DELETE') throw new Error('Type DELETE to confirm.');
      result = await db.rpc('delete_my_account');
      break;
    }
    default: {
      if (!apiBase)
        throw new Error(
          'Social account connections are awaiting platform setup. No account has been connected.',
        );
      const {
        data: { session },
      } = await db.auth.getSession();
      const response = await fetch(apiBase + '/api/actions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Request failed.');
      return body;
    }
  }
  if (result.error) {
    const error = result.error as { code?: string; message?: string };
    if (error.code === '23505') throw new Error('This profile is already saved in your workspace.');
    throw new Error(error.message || 'We couldn’t save this change. Please try again.');
  }
  return { ok: true };
}
export async function startSocialConnection(platform: Platform) {
  if (!supabase || !apiBase)
    throw new Error(
      'This connection is awaiting platform approval and secure authorization setup. You can save your profile link in the meantime.',
    );
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const response = await fetch(apiBase + `/api/connect/${platform}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  window.location.assign(body.url);
}
