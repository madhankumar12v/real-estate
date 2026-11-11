-- MrSa Properties Instagram publishing queue.
-- Run in Supabase Dashboard > SQL Editor before deploying the Worker.
create table if not exists public.instagram_posts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  caption text not null check (char_length(caption) between 1 and 2200),
  image_url text not null,
  status text not null default 'draft' check (status in ('draft','approved','publishing','published','failed')),
  created_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  ig_container_id text,
  ig_media_id text,
  permalink text,
  last_error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists instagram_posts_status_created_idx on public.instagram_posts(status,created_at desc);
create index if not exists instagram_posts_listing_idx on public.instagram_posts(listing_id);
alter table public.instagram_posts enable row level security;
drop policy if exists "instagram posts admin select" on public.instagram_posts;
create policy "instagram posts admin select" on public.instagram_posts for select to authenticated using (public.is_admin());
drop policy if exists "instagram posts admin insert" on public.instagram_posts;
create policy "instagram posts admin insert" on public.instagram_posts for insert to authenticated with check (public.is_admin() and created_by=auth.uid());
drop policy if exists "instagram posts admin update" on public.instagram_posts;
create policy "instagram posts admin update" on public.instagram_posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "instagram posts admin delete" on public.instagram_posts;
create policy "instagram posts admin delete" on public.instagram_posts for delete to authenticated using (public.is_admin());
