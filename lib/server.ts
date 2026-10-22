import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is incomplete.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new Error('Unauthorized');
  const db = adminClient();
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new Error('Unauthorized');
  return { db, user: data.user };
}
export const fail = (error: unknown) =>
  Response.json(
    { error: error instanceof Error ? error.message : 'Request failed' },
    { status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 400 },
  );
