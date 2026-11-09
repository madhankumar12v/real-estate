-- MrSa Properties: record public visits to approved property detail pages.
create table if not exists public.listing_views (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists listing_views_viewed_at_idx
  on public.listing_views (viewed_at desc);
create index if not exists listing_views_listing_viewed_idx
  on public.listing_views (listing_id, viewed_at desc);

alter table public.listing_views enable row level security;

drop policy if exists "public record approved listing views" on public.listing_views;
create policy "public record approved listing views"
  on public.listing_views for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'approved'
    )
  );

drop policy if exists "admins read listing views" on public.listing_views;
create policy "admins read listing views"
  on public.listing_views for select to authenticated
  using (public.is_admin());

grant insert on public.listing_views to anon, authenticated;
grant select on public.listing_views to authenticated;
