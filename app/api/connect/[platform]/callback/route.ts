import { NextRequest, NextResponse } from 'next/server';
import { adminClient } from '@/lib/server';
import { decrypt, encrypt } from '@/lib/crypto';
import { exchangeCode, fetchSnapshot } from '@/lib/adapters';
import { checked } from '@/lib/services';
import { Platform } from '@/lib/types';
export async function GET(req: NextRequest, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params;
  const base = process.env.APP_URL || 'http://localhost:3000';
  let target = '/?connection=success';
  try {
    if (!['instagram', 'tiktok'].includes(platform)) throw new Error('Unsupported platform');
    const cookie = req.cookies.get(`sl_oauth_${platform}`)?.value;
    if (!cookie) throw new Error('Connection session expired. Please try again.');
    const s = decrypt<{ userId: string; state: string; verifier: string; issuedAt: number }>(
      cookie,
    );
    if (s.state !== req.nextUrl.searchParams.get('state') || Date.now() - s.issuedAt > 600000)
      throw new Error('Connection session expired.');
    const code = req.nextUrl.searchParams.get('code');
    if (!code || req.nextUrl.searchParams.has('error'))
      throw new Error('Authorization was not completed.');
    const tokens = await exchangeCode(platform as Platform, code, s.verifier);
    const fresh = await fetchSnapshot(platform as Platform, tokens);
    const db = adminClient();
    const { data } = checked(
      await db
        .from('profiles')
        .upsert(
          {
            user_id: s.userId,
            platform,
            username: fresh.username,
            display_name: fresh.name,
            kind: 'connected',
            status: 'connected',
            last_sync: new Date().toISOString(),
            followers: fresh.snapshot.followers,
            bio: fresh.snapshot.bio,
          },
          { onConflict: 'user_id,platform,username,kind' },
        )
        .select('*')
        .single(),
    );
    checked(
      await db.rpc('internal_set_credentials', {
        p_id: data.id,
        p_user: s.userId,
        p_token: encrypt(tokens),
        p_external: fresh.externalId,
        p_expires: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
        p_scopes: tokens.scope?.split(',') || [],
      }),
    );
    checked(
      await db.rpc('internal_set_snapshot', {
        p_id: data.id,
        p_user: s.userId,
        p_snapshot: {
          ...fresh.snapshot,
          baseline_at: new Date().toISOString(),
          known_post_ids: fresh.snapshot.posts.map((p) => p.id),
        },
      }),
    );
  } catch (e) {
    target = `/?connection=error&message=${encodeURIComponent(e instanceof Error ? e.message : 'Connection failed')}`;
  }
  const r = NextResponse.redirect(new URL(target, base));
  r.cookies.set(`sl_oauth_${platform}`, '', { maxAge: 0, path: `/api/connect/${platform}` });
  return r;
}
