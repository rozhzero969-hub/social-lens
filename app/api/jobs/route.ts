import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { adminClient } from '@/lib/server';
import { checked, generateReport, syncProfile } from '@/lib/services';
import { reportDue, inQuietHours, localClock } from '@/lib/monitoring';
import { defaultPreferences } from '@/lib/types';
export const maxDuration = 300;
export async function POST(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const actual = req.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (
    !expected ||
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const db = adminClient();
    const { data: profiles } = checked(
      await db.from('profiles').select('*').eq('kind', 'connected').eq('status', 'connected'),
    );
    const results: { id: string; ok: boolean }[] = [];
    for (const p of profiles || []) {
      if (p.last_sync && Date.now() - new Date(p.last_sync).getTime() < 3600000) continue;
      try {
        await syncProfile(p);
        results.push({ id: p.id, ok: true });
      } catch {
        results.push({ id: p.id, ok: false });
      }
    }
    const { data: prefs } = checked(await db.from('preferences').select('*'));
    let reports = 0;
    for (const preference of prefs || []) {
      const p = { ...defaultPreferences, ...preference };
      checked(
        await db.rpc('internal_retention', {
          p_user: preference.user_id,
          p_days: p.retention_days,
        }),
      );
      if (!reportDue(p)) continue;
      const report = await generateReport(preference.user_id, p);
      reports++;
      if (p.email_enabled && process.env.RESEND_API_KEY && process.env.REPORT_FROM_EMAIL) {
        const local = localClock(p.timezone);
        let run = new Date();
        if (inQuietHours(p.quiet_start, p.quiet_end, local.time))
          run = new Date(Date.now() + 3600000);
        checked(
          await db.rpc('internal_enqueue', {
            p_user: preference.user_id,
            p_profile: null,
            p_kind: 'email',
            p_payload: { reportId: report.id },
            p_after: run.toISOString(),
          }),
        );
      }
    }
    const { data: jobs } = checked(await db.rpc('internal_claim_jobs'));
    for (const job of jobs || []) {
      try {
        if (job.kind !== 'email') throw new Error('Unsupported job type');
        const { data: p } = checked(
          await db.from('preferences').select('*').eq('user_id', job.user_id).single(),
        );
        if (!p?.email_enabled) {
          checked(await db.rpc('internal_finish_job', { p_id: job.id, p_error: null }));
          continue;
        }
        if (inQuietHours(p.quiet_start, p.quiet_end, localClock(p.timezone).time)) {
          checked(await db.rpc('internal_defer_job', { p_id: job.id }));
          continue;
        }
        const { data: r } = checked(
          await db
            .from('reports')
            .select('*')
            .eq('id', job.payload.reportId)
            .eq('user_id', job.user_id)
            .single(),
        );
        const { data: u, error } = await db.auth.admin.getUserById(job.user_id);
        if (error || !u.user?.email || !r) throw new Error('Recipient or report unavailable');
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': `report-${r.id}`,
          },
          body: JSON.stringify({
            from: process.env.REPORT_FROM_EMAIL,
            to: u.user.email,
            subject: 'Your Social Lens daily briefing',
            text: `${r.summary}\n\nRead your report: ${process.env.APP_URL}\n\nManage email preferences in Settings.`,
          }),
        });
        if (!res.ok) throw new Error('Email delivery failed');
        checked(await db.rpc('internal_finish_job', { p_id: job.id, p_error: null }));
      } catch (e) {
        await db.rpc('internal_finish_job', {
          p_id: job.id,
          p_error: e instanceof Error ? e.message : 'Job failed',
        });
      }
    }
    return Response.json({ synced: results, reports, jobs: jobs?.length || 0 });
  } catch {
    return Response.json(
      { error: 'Worker failed. Check server logs and database configuration.' },
      { status: 500 },
    );
  }
}
