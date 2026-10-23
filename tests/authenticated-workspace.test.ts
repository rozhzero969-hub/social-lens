import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
test('signed-in clients can save their own real links without forging connections or reports', async () => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${alice}'),('${bob}');`,
  );
  for (const migration of [
    '20261022164107_initial_social_lens.sql',
    '20261022181413_authenticated_workspace.sql',
    '20261022183601_restrict_privileged_helpers.sql',
    '20261023160900_snapchat_public_profiles.sql',
  ])
    await db.exec(await readFile('supabase/migrations/' + migration, 'utf8'));
  await db.exec(
    `set role authenticated;set request.jwt.claim.sub='${alice}';insert into public.preferences(user_id) values('${alice}');`,
  );
  const saved = await db.query<{ id: string }>(
    `insert into public.profiles(user_id,platform,username,display_name,kind,status,alerts) values('${alice}','instagram','my.account','my.account','saved','unsupported',false) returning id`,
  );
  const id = saved.rows[0].id;
  await db.exec(
    `insert into public.profiles(user_id,platform,username,display_name,kind,status,alerts) values('${alice}','snapchat','espn-snap','ESPN','saved','unsupported',false);insert into public.bookmarks(user_id,title,url,platform) values('${alice}','Snap','https://www.snapchat.com/spotlight/abc','snapchat');`,
  );
  await assert.rejects(
    db.exec(
      `insert into public.profiles(user_id,platform,username,display_name,kind,status,alerts) values('${alice}','snapchat','fake','Fake','connected','connected',true)`,
    ),
  );
  // Separate authenticated transactions represent devices using the same account.
  await db.exec(
    `begin;insert into public.bookmarks(user_id,title,url,platform,collection) values('${alice}','My post','https://www.instagram.com/p/ABC/','instagram','Profile:instagram:my.account');update public.preferences set language='Kurdish' where user_id='${alice}';commit;reset role;`,
  );
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${alice}';begin;`);
  assert.equal((await db.query('select * from public.profiles')).rows.length, 2);
  assert.equal(
    (await db.query<{ language: string }>('select language from public.preferences')).rows[0]
      .language,
    'Kurdish',
  );
  assert.equal((await db.query('select * from public.bookmarks')).rows.length, 2);
  await db.exec('commit;');
  await assert.rejects(
    db.exec(
      `insert into public.profiles(user_id,platform,username,display_name,kind,status,alerts) values('${alice}','tiktok','forged','forged','connected','connected',true)`,
    ),
  );
  await assert.rejects(
    db.exec(
      `insert into public.profiles(user_id,platform,username,display_name,kind,status,alerts) values('${bob}','tiktok','forged','forged','saved','unsupported',false)`,
    ),
  );
  await assert.rejects(db.exec(`select public.create_my_report()`), /Connect an account/);
  await assert.rejects(
    db.exec(
      `insert into public.reports(user_id,title,date,summary,coverage,items,generated_by) values('${alice}','Fake',current_date,'fake','{}','[]','ai')`,
    ),
  );
  await db.exec(`set request.jwt.claim.sub='${bob}';`);
  assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
  assert.equal((await db.query('select * from public.bookmarks')).rows.length, 0);
  assert.equal((await db.query('select * from public.preferences')).rows.length, 0);
  await assert.rejects(db.query('select public.remove_my_saved_profile($1,true)', [id]));
  await db.exec(`set request.jwt.claim.sub='${alice}';`);
  await db.exec(`delete from public.profiles where platform='snapchat';`);
  await db.query('select public.remove_my_saved_profile($1,true)', [id]);
  assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
  await db.exec(`reset role;set role anon;`);
  await assert.rejects(db.exec('select public.create_my_report()'));
  await assert.rejects(db.exec('select public.delete_my_account()'));
  await db.exec('reset role;');
  await db.exec(
    `insert into auth.sessions values('33333333-3333-4333-8333-333333333333','${alice}');set role authenticated;set request.jwt.claim.sub='${alice}';select public.delete_my_account();reset role;`,
  );
  assert.equal((await db.query(`select * from auth.users where id='${alice}'`)).rows.length, 0);
  assert.equal(
    (await db.query(`select * from auth.sessions where user_id='${alice}'`)).rows.length,
    0,
  );
  assert.equal((await db.query(`select * from auth.users where id='${bob}'`)).rows.length, 1);
  await db.close();
});
