-- Facebook publishing queue. Run once in Supabase SQL Editor after the core schema.
create table if not exists public.facebook_posts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  caption text not null check (char_length(caption) between 1 and 5000),
  image_url text not null,
  status text not null default 'draft' check (status in ('draft','approved','publishing','published','failed')),
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  fb_media_id text,
  fb_post_id text,
  permalink text,
  last_error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists facebook_posts_created_at_idx on public.facebook_posts(created_at desc);
create index if not exists facebook_posts_listing_id_idx on public.facebook_posts(listing_id);
alter table public.facebook_posts enable row level security;
revoke all on public.facebook_posts from anon;
grant select, insert, update, delete on public.facebook_posts to authenticated;
drop policy if exists "facebook posts admin read" on public.facebook_posts;
create policy "facebook posts admin read" on public.facebook_posts for select to authenticated using (public.is_admin());
drop policy if exists "facebook posts admin create" on public.facebook_posts;
create policy "facebook posts admin create" on public.facebook_posts for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
drop policy if exists "facebook posts admin update" on public.facebook_posts;
create policy "facebook posts admin update" on public.facebook_posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "facebook posts admin delete" on public.facebook_posts;
create policy "facebook posts admin delete" on public.facebook_posts for delete to authenticated using (public.is_admin());
