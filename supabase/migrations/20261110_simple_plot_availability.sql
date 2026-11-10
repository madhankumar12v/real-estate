-- Simple plot availability counts for existing Plot listings.
create table if not exists public.plot_availability (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  available_count integer not null default 0 check (available_count >= 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  sold_count integer not null default 0 check (sold_count >= 0),
  total_count integer generated always as (available_count + reserved_count + sold_count) stored,
  updated_at timestamptz not null default now()
);
alter table public.plot_availability enable row level security;
drop policy if exists "approved plot availability public read" on public.plot_availability;
create policy "approved plot availability public read" on public.plot_availability
  for select using (exists (
    select 1 from public.listings l
    where l.id = listing_id and l.status = 'approved'
  ));
drop policy if exists "admins manage plot availability" on public.plot_availability;
create policy "admins manage plot availability" on public.plot_availability
  for all to authenticated using (public.is_admin())
  with check (public.is_admin());
create index if not exists plot_availability_listing_id_idx
  on public.plot_availability(listing_id);
