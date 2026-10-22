import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
test('migration enforces tenant isolation and server-only writes in real PostgreSQL', async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${alice}'),('${bob}');`,
  );
  await db.exec(
    await readFile('supabase/migrations/20261022164107_initial_social_lens.sql', 'utf8'),
  );
  const a = await db.query<{ id: string }>(
    `insert into public.profiles(user_id,platform,username,display_name,kind,status) values('${alice}','tiktok','alice','Alice','connected','connected') returning id`,
  );
  const profileId = a.rows[0].id;
  await db.exec(
    `insert into public.preferences(user_id) values('${alice}'),('${bob}');insert into public.bookmarks(user_id,title,url,platform) values('${alice}','Alice private','https://tiktok.com/@alice','tiktok'),('${bob}','Bob private','https://instagram.com/bob','instagram');set role authenticated;set request.jwt.claim.sub='${alice}';`,
  );
  const visible = await db.query<{ title: string }>('select title from public.bookmarks');
  assert.deepEqual(
    visible.rows.map((r) => r.title),
    ['Alice private'],
  );
  await assert.rejects(
    db.exec(
      `insert into public.bookmarks(user_id,title,url,platform) values('${bob}','forged','https://tiktok.com/@bob','tiktok')`,
    ),
  );
  await assert.rejects(
    db.exec(
      `insert into public.profiles(user_id,platform,username,display_name,kind,status) values('${alice}','tiktok','forged','Forged','connected','connected')`,
    ),
  );
  await assert.rejects(db.exec(`select public.internal_get_credentials('${profileId}')`));
  await assert.rejects(db.exec(`select * from private.credentials`));
  await assert.rejects(
    db.exec(`update public.preferences set user_id='${bob}' where user_id='${alice}'`),
  );
  const update = await db.query(
    `update public.preferences set report_time='10:00' where user_id='${bob}' returning *`,
  );
  assert.equal(update.rows.length, 0);
  await db.exec(`reset role;set role anon;`);
  await assert.rejects(db.exec('select * from public.bookmarks'));
  await db.exec('reset role;');
  const f = await db.query<{ count: number }>(
    `select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity`,
  );
  assert.equal(f.rows[0].count, 0);
  // Sync completion after a disconnect must never recreate snapshots or alerts.
  await db.exec(
    `select public.internal_set_credentials('${profileId}','${alice}','encrypted','external',null,'{}');select public.internal_disconnect('${profileId}','${alice}',false);`,
  );
  const applied = await db.query<{ applied: boolean }>(
    `select public.internal_apply_sync('${profileId}','${alice}',null,'{"bio":"x","followers":2,"posts":[]}','[]','alice','Alice') as applied`,
  );
  assert.equal(applied.rows[0].applied, false);
  const snapshots = await db.query('select * from private.snapshots');
  assert.equal(snapshots.rows.length, 0);
  await assert.rejects(
    db.exec(
      `select public.internal_set_credentials('${profileId}','${alice}','new-token','external',null,'{}')`,
    ),
  );
  await assert.rejects(
    db.exec(`select public.internal_set_snapshot('${profileId}','${alice}','{}')`),
  );
  // Cross-user relationships cannot be forged, even accidentally by server writes.
  await assert.rejects(
    db.exec(
      `insert into public.changes(id,user_id,profile_id,platform,username,kind,title,detail,source_url) values('forged','${bob}','${profileId}','tiktok','bob','post','x','x','https://tiktok.com/')`,
    ),
  );
  await assert.rejects(
    db.exec(`update public.preferences set timezone='Not/A_Timezone' where user_id='${alice}'`),
  );
  // Quiet-hour deferrals do not consume retries or lose an eventual email.
  await db.exec(
    `select public.internal_enqueue('${alice}',null,'email','{}',now());select * from public.internal_claim_jobs();`,
  );
  const job = await db.query<{ id: string }>('select id from private.jobs');
  await db.query('select public.internal_defer_job($1)', [job.rows[0].id]);
  const deferred = await db.query<{ state: string; attempts: number }>(
    'select state,attempts from private.jobs',
  );
  assert.equal(deferred.rows[0].state, 'queued');
  assert.equal(deferred.rows[0].attempts, 0);
  // Deletion removes report copies containing that profile, not just source rows.
  await db.query(
    `insert into public.reports(user_id,title,date,summary,coverage,items,generated_by) values($1,'Report',current_date,'Summary','{}',$2,'template')`,
    [alice, JSON.stringify([{ profile_id: profileId }])],
  );
  await db.query('select public.internal_disconnect($1,$2,true)', [profileId, alice]);
  assert.equal((await db.query('select * from public.reports')).rows.length, 0);
  await db.close();
});
