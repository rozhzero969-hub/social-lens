-- Snapchat is public-viewing only. Existing RLS and grants remain unchanged.
alter table public.profiles drop constraint profiles_platform_check;
alter table public.profiles add constraint profiles_platform_check check (platform in ('instagram','tiktok','snapchat'));
alter table public.profiles add constraint profiles_snapchat_saved_only check (platform <> 'snapchat' or (kind='saved' and status='unsupported' and alerts=false));
alter table public.bookmarks drop constraint bookmarks_platform_check;
alter table public.bookmarks add constraint bookmarks_platform_check check (platform in ('instagram','tiktok','snapchat'));
alter table public.bookmarks drop constraint bookmarks_url_check;
alter table public.bookmarks add constraint bookmarks_url_check check (url ~ '^https://(www\.)?(instagram\.com|tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com|snapchat\.com)/');
