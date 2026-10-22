import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
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
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const r = NextResponse.json({ url: authorizationUrl(platform as Platform, state, challenge) });
    r.cookies.set(
      `sl_oauth_${platform}`,
      encrypt({ userId: user.id, state, verifier, issuedAt: Date.now() }),
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
