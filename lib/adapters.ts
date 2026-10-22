import { Platform } from './types';
import { Snapshot } from './monitoring';
import { profileUrl } from './platforms';
export type Tokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  user_id?: string;
  scope?: string;
};
export async function platformFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20000),
    cache: 'no-store',
  });
  const body = await response.json();
  if (
    !response.ok ||
    typeof body.error === 'string' ||
    (body.error?.code && body.error.code !== 'ok') ||
    (body.error?.message && body.error.code !== 'ok')
  )
    throw new Error(
      response.status === 401 || body.error?.code === 190 || body.error === 'invalid_grant'
        ? 'Connection expired. Reconnect your account.'
        : 'The platform could not complete this request. Try again later.',
    );
  return body;
}
export function platformReady(p: Platform) {
  return Boolean(
    process.env.TOKEN_ENCRYPTION_KEY &&
    process.env.APP_URL &&
    process.env.SUPABASE_SECRET_KEY &&
    (p === 'tiktok'
      ? process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET
      : process.env.INSTAGRAM_CLIENT_ID && process.env.INSTAGRAM_CLIENT_SECRET),
  );
}
export function callbackUrl(p: Platform) {
  return `${process.env.APP_URL}/api/connect/${p}/callback`;
}
export function authorizationUrl(p: Platform, state: string) {
  const url = new URL(
    p === 'tiktok'
      ? 'https://www.tiktok.com/v2/auth/authorize/'
      : 'https://www.instagram.com/oauth/authorize',
  );
  const params =
    p === 'tiktok'
      ? {
          client_key: process.env.TIKTOK_CLIENT_KEY!,
          scope: 'user.info.basic,user.info.profile,user.info.stats,video.list',
          response_type: 'code',
          redirect_uri: callbackUrl(p),
          state,
        }
      : {
          client_id: process.env.INSTAGRAM_CLIENT_ID!,
          scope: 'instagram_business_basic',
          response_type: 'code',
          redirect_uri: callbackUrl(p),
          state,
        };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}
export async function exchangeCode(p: Platform, code: string): Promise<Tokens> {
  if (p === 'tiktok')
    return platformFetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl(p),
      }),
    });
  const short = await platformFetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.INSTAGRAM_CLIENT_ID!,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: callbackUrl(p),
      code,
    }),
  });
  const longUrl = new URL('https://graph.instagram.com/access_token');
  longUrl.search = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: process.env.INSTAGRAM_CLIENT_SECRET!,
    access_token: short.access_token,
  }).toString();
  const long = await platformFetch(longUrl.toString());
  return { ...long, user_id: String(short.user_id) };
}
export async function refreshTokens(p: Platform, t: Tokens): Promise<Tokens> {
  if (p === 'tiktok') {
    if (!t.refresh_token) throw new Error('Reconnect this TikTok account.');
    return platformFetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: t.refresh_token,
      }),
    });
  }
  const u = new URL('https://graph.instagram.com/refresh_access_token');
  u.search = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: t.access_token,
  }).toString();
  return { ...t, ...(await platformFetch(u.toString())) };
}
export async function fetchSnapshot(
  p: Platform,
  t: Tokens,
): Promise<{ externalId: string; username: string; name: string; snapshot: Snapshot }> {
  if (p === 'tiktok') {
    const headers = {
      Authorization: `Bearer ${t.access_token}`,
      'Content-Type': 'application/json',
    };
    const profile = await platformFetch(
      'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,bio_description,username,follower_count',
      { headers },
    );
    const videos = await platformFetch(
      'https://open.tiktokapis.com/v2/video/list/?fields=id,title,share_url,create_time',
      { method: 'POST', headers, body: JSON.stringify({ max_count: 20 }) },
    );
    const u = profile.data.user;
    return {
      externalId: u.open_id,
      username: u.username || u.open_id,
      name: u.display_name,
      snapshot: {
        bio: u.bio_description || '',
        followers: u.follower_count ?? null,
        posts: (videos.data.videos || []).map(
          (v: { id: string; title: string; share_url: string; create_time: number }) => ({
            id: v.id,
            title: v.title,
            url: v.share_url,
            posted_at: new Date(v.create_time * 1000).toISOString(),
          }),
        ),
      },
    };
  }
  const version = process.env.INSTAGRAM_API_VERSION || 'v24.0';
  const headers = { Authorization: `Bearer ${t.access_token}` };
  const u = await platformFetch(
    `https://graph.instagram.com/${version}/me?fields=user_id,username,name,biography,followers_count`,
    { headers },
  );
  const media = await platformFetch(
    `https://graph.instagram.com/${version}/${u.user_id}/media?fields=id,caption,permalink,timestamp&limit=25`,
    { headers },
  );
  return {
    externalId: String(u.user_id),
    username: u.username,
    name: u.name || u.username,
    snapshot: {
      bio: u.biography || '',
      followers: u.followers_count ?? null,
      posts: (media.data || []).map(
        (v: { id: string; caption: string; permalink: string; timestamp: string }) => ({
          id: v.id,
          title: v.caption?.slice(0, 180) || 'New Instagram post',
          url: v.permalink,
          posted_at: v.timestamp,
        }),
      ),
    },
  };
}
export async function revokeToken(p: Platform, t: Tokens, externalId: string) {
  if (p === 'tiktok')
    await platformFetch('https://open.tiktokapis.com/v2/oauth/revoke/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY!,
        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
        token: t.access_token,
      }),
    });
  else
    await platformFetch(
      `https://graph.instagram.com/${process.env.INSTAGRAM_API_VERSION || 'v24.0'}/${externalId}/permissions`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${t.access_token}` } },
    );
}
export { profileUrl };
