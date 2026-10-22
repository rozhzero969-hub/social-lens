-- Safe client operations for the signed-in app hosted on GitHub Pages.
create policy own_saved_profiles_insert on public.profiles for insert to authenticated
with check((select auth.uid())=user_id and kind='saved' and status='unsupported' and followers is null and last_sync is null and alerts=false);
grant insert(user_id,platform,username,display_name,kind,status,alerts) on public.profiles to authenticated;
create policy own_changes_mark_read on public.changes for update to authenticated
using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
grant update(read) on public.changes to authenticated;

-- The definer is necessary to insert verified reports without allowing browser
-- clients to fabricate source records, AI labels, or coverage. Identity is read
-- from the authenticated session; callers cannot supply another user's ID.
create function public.create_my_report() returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); prefs public.preferences; report public.reports; local_day date;
 account_total integer; successful integer; changes jsonb; summary_text text;
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 select * into prefs from public.preferences where user_id=owner_id;
 if prefs.user_id is null then raise exception 'Save your report preferences first'; end if;
 local_day:=(now() at time zone prefs.timezone)::date;
 select * into report from public.reports where user_id=owner_id and date=local_day for update;
 if report.created_at>now()-interval '1 minute' then return to_jsonb(report); end if;
 select count(*),count(*) filter(where status='connected' and last_sync_error is null and last_sync>now()-interval '2 hours')
 into account_total,successful from public.profiles where user_id=owner_id and kind='connected' and status<>'paused';
 if account_total=0 then raise exception 'Connect an account before generating reports'; end if;
 select coalesce(jsonb_agg(to_jsonb(c) order by c.detected_at desc),'[]'::jsonb) into changes
 from (select id,profile_id,platform,username,kind,title,detail,detected_at,posted_at,source_url,read from public.changes where user_id=owner_id and detected_at>=now()-interval '24 hours' order by detected_at desc limit 200) c;
 summary_text:=format('%s observed updates in the last 24 hours. %s of %s accounts checked successfully.',jsonb_array_length(changes),successful,account_total);
 if successful<account_total then summary_text:=summary_text||' Some checks are incomplete. Missing activity cannot be ruled out.'; end if;
 insert into public.reports(user_id,title,date,summary,coverage,items,generated_by,created_at)
 values(owner_id,'Your daily social briefing',local_day,summary_text,jsonb_build_object('success',successful,'total',account_total,'failed',account_total-successful),changes,'template',now())
 on conflict(user_id,date) do update set summary=excluded.summary,coverage=excluded.coverage,items=excluded.items,created_at=excluded.created_at,generated_by='template' returning * into report;
 return to_jsonb(report);
end $$;
revoke all on function public.create_my_report() from public,anon;
grant execute on function public.create_my_report() to authenticated;

create function public.remove_my_saved_profile(profile uuid,delete_history boolean default true) returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 perform 1 from public.profiles p where p.id=profile and p.user_id=owner_id and p.kind='saved' for update;
 if not found then raise exception 'Saved profile not found'; end if;
 delete from public.profiles p where p.id=profile and p.user_id=owner_id and p.kind='saved';
end $$;
revoke all on function public.remove_my_saved_profile(uuid,boolean) from public,anon;
grant execute on function public.remove_my_saved_profile(uuid,boolean) to authenticated;

create function public.delete_my_account() returns void language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 if exists(select 1 from public.profiles where user_id=owner_id and kind='connected' and status='connected') then raise exception 'Disconnect your social accounts before deleting your account'; end if;
 delete from auth.sessions where user_id=owner_id;
 delete from auth.users where id=owner_id;
end $$;
revoke all on function public.delete_my_account() from public,anon;
grant execute on function public.delete_my_account() to authenticated;

-- Real-time events are still subject to the existing ownership SELECT policies.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='changes') then alter publication supabase_realtime add table public.changes;end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reports') then alter publication supabase_realtime add table public.reports;end if;
 end if;
end $$;
