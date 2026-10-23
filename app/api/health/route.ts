export async function GET() {
  return Response.json({
    status: 'ok',
    databaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
    ),
    platforms: {
      instagram: platformReady('instagram'),
      tiktok: platformReady('tiktok'),
    },
  });
}
import { platformReady } from '@/lib/adapters';
