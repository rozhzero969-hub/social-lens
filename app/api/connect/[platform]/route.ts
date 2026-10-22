import { NextRequest, NextResponse } from 'next/server';
import { requireUser, fail } from '@/lib/server';
import { encrypt, randomBytes } from '@/lib/crypto';
import { authorizationUrl, platformReady } from '@/lib/adapters';
import { Platform } from '@/lib/types';
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const { platform } = await params;
    if (!['instagram', 'tiktok'].includes(platform)) throw new Error('Unsupported platform.');
    const { user } = await requireUser(req);
    if (!platformReady(platform as Platform))
      return Response.json(
        {
          error:
            'This platform connection needs developer credentials and platform approval. Your social password is never requested.',
        },
        { status: 503 },
      );
    const state = randomBytes(24).toString('hex');
    const r = NextResponse.json({ url: authorizationUrl(platform as Platform, state) });
    r.cookies.set(
      `sl_oauth_${platform}`,
      encrypt({ userId: user.id, state, issuedAt: Date.now() }),
      {
        httpOnly: true,
        secure: process.env.APP_URL?.startsWith('https://'),
        sameSite: 'lax',
        path: `/api/connect/${platform}`,
        maxAge: 600,
      },
    );
    return r;
  } catch (e) {
    return fail(e);
  }
}
