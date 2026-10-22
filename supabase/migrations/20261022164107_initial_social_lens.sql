-- Every client-readable row is owned by one authenticated user.
create table public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Baghdad',
  report_time text not null default '09:00' check (report_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  language text not null default 'English' check (language in ('English','Arabic','Kurdish')),
  report_length text not null default 'short' check(report_length in ('short','detailed')),
  email_enabled boolean not null default false,
  digest_only boolean not null default false,
  quiet_start text not null default '22:00' check (quiet_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  quiet_end text not null default '08:00' check (quiet_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  retention_days integer not null default 90 check (retention_days between 7 and 365),
  last_report_date date,
  updated_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check(platform in ('instagram','tiktok')),
  username text not null check(length(username) between 1 and 100), display_name text not null,
  kind text not null check(kind in ('connected','saved')),
  status text not null default 'setup_required' check(status in ('connected','setup_required','expired','paused','unsupported')),
  last_sync timestamptz, followers bigint, bio text not null default '', alerts boolean not null default true,
  created_at timestamptz not null default now(), unique(user_id,platform,username,kind), unique(id,user_id)
);
create table public.changes (
  id text primary key, user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid not null, platform text not null check(platform in ('instagram','tiktok')), username text not null,
  kind text not null check(kind in ('post','bio','metric','connection')), title text not null, detail text not null,
  detected_at timestamptz not null default now(), posted_at timestamptz, source_url text not null, read boolean not null default false,
  foreign key(profile_id,user_id) references public.profiles(id,user_id) on delete cascade
);
create table public.reports (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null, date date not null, summary text not null, coverage jsonb not null,
  items jsonb not null default '[]', generated_by text not null check(generated_by in ('template','ai')),
  created_at timestamptz not null default now(), unique(user_id,date)
);
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check(length(title) between 1 and 300), url text not null check(url ~ '^https://(www\.)?(instagram\.com|tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)/'),
  platform text not null check(platform in ('instagram','tiktok')), collection text not null default 'Inspiration',
  created_at timestamptz not null default now()
);
-- Internal state is never accessible through client roles.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.credentials (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  encrypted_token text not null, platform_user_id text not null, expires_at timestamptz,
  scopes text[] not null default '{}'
);
create table private.snapshots (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot jsonb not null, checked_at timestamptz not null default now()
);
create table private.jobs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  kind text not null check(kind in ('sync','report','email','revoke')),
  state text not null default 'queued' check(state in ('queued','running','done','failed','cancelled')),
  attempts integer not null default 0, run_after timestamptz not null default now(), locked_at timestamptz,
  payload jsonb not null default '{}', error text, created_at timestamptz not null default now()
);
create index profiles_user on public.profiles(user_id);
create index changes_user_time on public.changes(user_id,detected_at desc);
create index changes_profile on public.changes(profile_id,user_id);
create index reports_user_date on public.reports(user_id,date desc);
create index bookmarks_user on public.bookmarks(user_id);
create index jobs_queued on private.jobs(state,run_after);

alter table public.preferences enable row level security;
alter table public.profiles enable row level security;
alter table public.changes enable row level security;
alter table public.reports enable row level security;
alter table public.bookmarks enable row level security;
alter table private.credentials enable row level security;
alter table private.snapshots enable row level security;
alter table private.jobs enable row level security;

create policy own_preferences_read on public.preferences for select to authenticated using((select auth.uid())=user_id);
create policy own_preferences_insert on public.preferences for insert to authenticated with check((select auth.uid())=user_id);
create policy own_preferences_update on public.preferences for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_profiles_read on public.profiles for select to authenticated using((select auth.uid())=user_id);
create policy own_changes_read on public.changes for select to authenticated using((select auth.uid())=user_id);
create policy own_reports_read on public.reports for select to authenticated using((select auth.uid())=user_id);
create policy own_bookmarks_read on public.bookmarks for select to authenticated using((select auth.uid())=user_id);
create policy own_bookmarks_insert on public.bookmarks for insert to authenticated with check((select auth.uid())=user_id);
create policy own_bookmarks_delete on public.bookmarks for delete to authenticated using((select auth.uid())=user_id);

grant usage on schema public to authenticated;
grant select,insert on public.preferences to authenticated;
grant update(timezone,report_time,language,report_length,email_enabled,digest_only,quiet_start,quiet_end,retention_days,updated_at) on public.preferences to authenticated;
grant select on public.profiles,public.changes,public.reports to authenticated;
grant select,insert,delete on public.bookmarks to authenticated;
revoke all on public.preferences,public.profiles,public.changes,public.reports,public.bookmarks from anon;
grant all on public.preferences,public.profiles,public.changes,public.reports,public.bookmarks to service_role;

-- Narrow, server-only helpers keep tokens and queue payloads out of the Data API.
create function public.internal_get_snapshot(p_id uuid) returns jsonb language sql security definer set search_path='' as $$ select snapshot from private.snapshots where profile_id=p_id $$;
create function public.internal_set_snapshot(p_id uuid,p_user uuid,p_snapshot jsonb) returns void language sql security definer set search_path='' as $$ insert into private.snapshots(profile_id,user_id,snapshot) values(p_id,p_user,p_snapshot) on conflict(profile_id) do update set snapshot=excluded.snapshot,checked_at=now() $$;
create function public.internal_get_credentials(p_id uuid) returns jsonb language sql security definer set search_path='' as $$ select to_jsonb(c) from private.credentials c where profile_id=p_id $$;
create function public.internal_set_credentials(p_id uuid,p_user uuid,p_token text,p_external text,p_expires timestamptz,p_scopes text[]) returns void language sql security definer set search_path='' as $$ insert into private.credentials(profile_id,user_id,encrypted_token,platform_user_id,expires_at,scopes) values(p_id,p_user,p_token,p_external,p_expires,p_scopes) on conflict(profile_id) do update set encrypted_token=excluded.encrypted_token,platform_user_id=excluded.platform_user_id,expires_at=excluded.expires_at,scopes=excluded.scopes $$;
create function public.internal_disconnect(p_id uuid,p_user uuid,p_delete boolean) returns void language plpgsql security definer set search_path='' as $$ begin
  if not exists(select 1 from public.profiles where id=p_id and user_id=p_user) then raise exception 'Profile not found'; end if;
  delete from private.credentials where profile_id=p_id and user_id=p_user;
  delete from private.snapshots where profile_id=p_id and user_id=p_user;
  update private.jobs set state='cancelled' where profile_id=p_id and user_id=p_user and state in ('queued','running');
  if p_delete then
    -- Reports contain historical copies of source records; remove these too.
    delete from public.reports where user_id=p_user and items::text like '%'||p_id::text||'%';
    delete from public.profiles where id=p_id and user_id=p_user;
  else update public.profiles set status='paused',alerts=false where id=p_id and user_id=p_user; end if;
end $$;
create function public.internal_enqueue(p_user uuid,p_profile uuid,p_kind text,p_payload jsonb,p_after timestamptz) returns uuid language plpgsql security definer set search_path='' as $$ declare result uuid; begin
  insert into private.jobs(user_id,profile_id,kind,payload,run_after) values(p_user,p_profile,p_kind,p_payload,p_after) returning id into result;return result;
end $$;
create function public.internal_claim_jobs() returns setof private.jobs language sql security definer set search_path='' as $$
  update private.jobs set state='running',locked_at=now(),attempts=attempts+1 where id in (
    select id from private.jobs where (state='queued' and run_after<=now()) or (state='running' and locked_at<now()-interval '10 minutes')
    order by run_after limit 20 for update skip locked
  ) returning *
$$;
create function public.internal_finish_job(p_id uuid,p_error text default null) returns void language sql security definer set search_path='' as $$
  update private.jobs set state=case when p_error is null then 'done' when attempts>=3 then 'failed' else 'queued' end,error=p_error,run_after=now()+interval '15 minutes' where id=p_id and state='running'
$$;
create function public.internal_retention(p_user uuid,p_days integer) returns void language plpgsql security definer set search_path='' as $$ begin
  delete from public.changes where user_id=p_user and detected_at<now()-make_interval(days=>greatest(7,least(p_days,365)));
  delete from public.reports where user_id=p_user and created_at<now()-make_interval(days=>greatest(7,least(p_days,365)));
  delete from private.jobs where user_id=p_user and state in ('done','cancelled','failed') and created_at<now()-interval '7 days';
end $$;
-- All privileged helpers are denied to browsers, including logged-in browsers.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'internal_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;

-- One transaction serializes sync completion against disconnect and rejects stale baselines.
create function public.internal_apply_sync(p_id uuid,p_user uuid,p_expected timestamptz,p_snapshot jsonb,p_changes jsonb,p_username text,p_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare current_profile public.profiles; c jsonb;
begin
  select * into current_profile from public.profiles where id=p_id and user_id=p_user for update;
  if current_profile.id is null or current_profile.status<>'connected' or current_profile.last_sync is distinct from p_expected or not exists(select 1 from private.credentials where profile_id=p_id and user_id=p_user) then return false; end if;
  for c in select * from jsonb_array_elements(p_changes) loop
    insert into public.changes(id,user_id,profile_id,platform,username,kind,title,detail,detected_at,posted_at,source_url,read)
    values(c->>'id',p_user,p_id,current_profile.platform,p_username,c->>'kind',c->>'title',c->>'detail',(c->>'detected_at')::timestamptz,(c->>'posted_at')::timestamptz,c->>'source_url',false) on conflict(id) do nothing;
  end loop;
  insert into private.snapshots(profile_id,user_id,snapshot) values(p_id,p_user,p_snapshot) on conflict(profile_id) do update set snapshot=excluded.snapshot,checked_at=now();
  update public.profiles set last_sync=now(),bio=p_snapshot->>'bio',followers=(p_snapshot->>'followers')::bigint,username=p_username,display_name=p_name where id=p_id;
  return true;
end $$;
revoke all on function public.internal_apply_sync(uuid,uuid,timestamptz,jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.internal_apply_sync(uuid,uuid,timestamptz,jsonb,jsonb,text,text) to service_role;

alter table public.profiles add column last_attempt_at timestamptz;
alter table public.profiles add column last_sync_error text;
-- Serialize token/snapshot writes against disconnect, including token-refresh races.
create or replace function public.internal_set_credentials(p_id uuid,p_user uuid,p_token text,p_external text,p_expires timestamptz,p_scopes text[]) returns void language plpgsql security definer set search_path='' as $$ begin
  perform 1 from public.profiles where id=p_id and user_id=p_user and status='connected' for update;
  if not found then raise exception 'Connection is no longer active'; end if;
  insert into private.credentials(profile_id,user_id,encrypted_token,platform_user_id,expires_at,scopes) values(p_id,p_user,p_token,p_external,p_expires,p_scopes) on conflict(profile_id) do update set encrypted_token=excluded.encrypted_token,platform_user_id=excluded.platform_user_id,expires_at=excluded.expires_at,scopes=excluded.scopes;
end $$;
create or replace function public.internal_set_snapshot(p_id uuid,p_user uuid,p_snapshot jsonb) returns void language plpgsql security definer set search_path='' as $$ begin
  perform 1 from public.profiles where id=p_id and user_id=p_user and status='connected' for update;
  if not found then raise exception 'Connection is no longer active'; end if;
  insert into private.snapshots(profile_id,user_id,snapshot) values(p_id,p_user,p_snapshot) on conflict(profile_id) do update set snapshot=excluded.snapshot,checked_at=now();
end $$;
create or replace function public.internal_disconnect(p_id uuid,p_user uuid,p_delete boolean) returns void language plpgsql security definer set search_path='' as $$ begin
  perform 1 from public.profiles where id=p_id and user_id=p_user for update;
  if not found then raise exception 'Profile not found'; end if;
  delete from private.credentials where profile_id=p_id and user_id=p_user;
  delete from private.snapshots where profile_id=p_id and user_id=p_user;
  update private.jobs set state='cancelled' where profile_id=p_id and user_id=p_user and state in ('queued','running');
  if p_delete then
    delete from public.reports where user_id=p_user and items::text like '%'||p_id::text||'%';
    delete from public.profiles where id=p_id and user_id=p_user;
  else update public.profiles set status='paused',alerts=false where id=p_id and user_id=p_user; end if;
end $$;
-- Updating success health in a trigger keeps the atomic apply function compact.
create function private.sync_health() returns trigger language plpgsql set search_path='' as $$ begin
  if new.last_sync is distinct from old.last_sync and new.status='connected' then new.last_attempt_at:=new.last_sync;new.last_sync_error:=null;end if;return new;
end $$;
create trigger profiles_sync_health before update on public.profiles for each row execute function private.sync_health();

create function public.internal_defer_job(p_id uuid) returns void language sql security definer set search_path='' as $$
  update private.jobs set state='queued',attempts=greatest(0,attempts-1),run_after=now()+interval '15 minutes',locked_at=null where id=p_id and state='running'
$$;
revoke all on function public.internal_defer_job(uuid) from public,anon,authenticated;
grant execute on function public.internal_defer_job(uuid) to service_role;

create function private.validate_preferences() returns trigger language plpgsql set search_path='' as $$ begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Unknown timezone'; end if;
  new.updated_at:=now();return new;
end $$;
create trigger preferences_validate before insert or update on public.preferences for each row execute function private.validate_preferences();
