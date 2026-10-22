-- A saved-link deletion can use ordinary ownership policies; it needs no elevated role.
create policy own_saved_profiles_delete on public.profiles for delete to authenticated
using ((select auth.uid())=user_id and kind='saved');
grant delete on public.profiles to authenticated;
alter function public.remove_my_saved_profile(uuid,boolean) security invoker;
-- Supabase's optional automatic-RLS event trigger is an administrative helper,
-- never a public API. Preserve its owner and trigger behavior, remove API access.
do $$ begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  execute 'revoke all on function public.rls_auto_enable() from public,anon,authenticated';
 end if;
end $$;
create or replace function public.remove_my_saved_profile(profile uuid,delete_history boolean default true) returns void language plpgsql security invoker set search_path='' as $$
declare owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Authentication required'; end if;
 delete from public.profiles p where p.id=profile and p.user_id=owner_id and p.kind='saved';
 if not found then raise exception 'Saved profile not found'; end if;
end $$;
