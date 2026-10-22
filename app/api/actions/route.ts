import { NextRequest } from 'next/server';
import { requireUser, fail } from '@/lib/server';
import { parseProfile, safeContentUrl } from '@/lib/platforms';
import { defaultPreferences, Platform } from '@/lib/types';
import { checked, generateReport, syncProfile } from '@/lib/services';
import { decrypt } from '@/lib/crypto';
import { revokeToken, Tokens } from '@/lib/adapters';
export async function POST(req: NextRequest) {
  try {
    const { db, user } = await requireUser(req);
    const b = await req.json();
    if (b.action === 'add-profile') {
      if (!['instagram', 'tiktok'].includes(b.platform))
        throw new Error('Choose Instagram or TikTok.');
      const username = parseProfile(String(b.username || ''), b.platform as Platform);
      const { count } = checked(
        await db
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      );
      if ((count || 0) >= 20) throw new Error('The beta supports up to 20 profiles per account.');
      checked(
        await db
          .from('profiles')
          .insert({
            user_id: user.id,
            username,
            display_name: username,
            platform: b.platform,
            kind: 'saved',
            status: 'unsupported',
            alerts: false,
          }),
      );
      return Response.json({ ok: true });
    }
    if (b.action === 'bookmark') {
      const { url, platform } = safeContentUrl(String(b.url));
      const title = String(b.title || 'Saved post')
        .trim()
        .slice(0, 300);
      checked(
        await db
          .from('bookmarks')
          .insert({
            user_id: user.id,
            url,
            platform,
            title,
            collection: String(b.collection || 'Inspiration').slice(0, 80),
          }),
      );
      return Response.json({ ok: true });
    }
    if (b.action === 'delete-bookmark') {
      checked(await db.from('bookmarks').delete().eq('id', b.id).eq('user_id', user.id));
      return Response.json({ ok: true });
    }
    if (b.action === 'mark-read') {
      let q = db.from('changes').update({ read: true }).eq('user_id', user.id);
      if (b.id) q = q.eq('id', b.id);
      checked(await q);
      return Response.json({ ok: true });
    }
    if (b.action === 'report') {
      const { data: existing } = checked(
        await db
          .from('reports')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1),
      );
      if (existing?.[0] && Date.now() - new Date(existing[0].created_at).getTime() < 60000)
        throw new Error('Your report is up to date. Please wait a minute before regenerating.');
      const { data: p } = checked(
        await db.from('preferences').select('*').eq('user_id', user.id).maybeSingle(),
      );
      const report = await generateReport(user.id, { ...defaultPreferences, ...p });
      return Response.json({ ok: true, report });
    }
    if (['disconnect', 'sync', 'alerts'].includes(b.action)) {
      const { data: p } = checked(
        await db.from('profiles').select('*').eq('id', b.id).eq('user_id', user.id).single(),
      );
      if (!p) throw new Error('Profile not found.');
      if (b.action === 'sync') {
        if (p.kind !== 'connected' || p.status !== 'connected')
          throw new Error('Connect an approved account before syncing.');
        if (p.last_sync && Date.now() - new Date(p.last_sync).getTime() < 300000)
          throw new Error('This account was checked recently. Try again in five minutes.');
        await syncProfile(p);
        return Response.json({ ok: true });
      }
      if (b.action === 'alerts') {
        if (p.status !== 'connected') throw new Error('Alerts require a supported connection.');
        checked(
          await db
            .from('profiles')
            .update({ alerts: Boolean(b.enabled) })
            .eq('id', p.id)
            .eq('user_id', user.id),
        );
        return Response.json({ ok: true });
      }
      const { data: c } = checked(await db.rpc('internal_get_credentials', { p_id: p.id }));
      let revoked = true;
      if (c) {
        try {
          await revokeToken(p.platform, decrypt<Tokens>(c.encrypted_token), c.platform_user_id);
        } catch {
          revoked = false;
        }
      }
      checked(
        await db.rpc('internal_disconnect', {
          p_id: p.id,
          p_user: user.id,
          p_delete: Boolean(b.deleteHistory),
        }),
      );
      return Response.json({
        ok: true,
        warning: revoked
          ? null
          : 'Collection has stopped and local credentials were removed. Platform revocation failed; remove Social Lens from your platform’s authorized apps too.',
      });
    }
    if (b.action === 'delete-account') {
      if (b.confirm !== 'DELETE') throw new Error('Type DELETE to confirm account deletion.');
      const { data: profiles } = checked(
        await db.from('profiles').select('*').eq('user_id', user.id),
      );
      let failed = 0;
      for (const p of profiles || []) {
        const { data: c } = checked(await db.rpc('internal_get_credentials', { p_id: p.id }));
        if (c)
          try {
            await revokeToken(p.platform, decrypt<Tokens>(c.encrypted_token), c.platform_user_id);
          } catch {
            failed++;
          }
      }
      // Revoke refresh sessions before deletion. Every app request also validates getUser.
      const token = req.headers.get('authorization')!.replace(/^Bearer /, '');
      checked(await db.auth.admin.signOut(token, 'global'));
      checked(await db.auth.admin.deleteUser(user.id));
      return Response.json({
        ok: true,
        warning: failed
          ? 'Account data deleted. Remove Social Lens authorization in your social platforms as well.'
          : null,
      });
    }
    throw new Error('Unknown action.');
  } catch (e) {
    return fail(e);
  }
}
