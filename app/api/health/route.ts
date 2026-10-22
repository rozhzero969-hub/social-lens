export async function GET() {
  return Response.json({
    status: 'ok',
    databaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
    ),
    platforms: {
      instagram: Boolean(process.env.INSTAGRAM_CLIENT_ID),
      tiktok: Boolean(process.env.TIKTOK_CLIENT_KEY),
    },
  });
}
