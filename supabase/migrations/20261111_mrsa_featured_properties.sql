-- MrSa Properties: admin-controlled homepage featured properties
-- Safe to run once in Supabase Dashboard > SQL Editor. Existing listings are preserved.
alter table public.listings
  add column if not exists is_featured boolean not null default false;

create index if not exists listings_homepage_featured_idx
  on public.listings (created_at desc)
  where status = 'approved' and is_featured = true;

comment on column public.listings.is_featured is
  'When true, an approved listing is shown in the homepage Featured Properties section. Admin controlled.';
