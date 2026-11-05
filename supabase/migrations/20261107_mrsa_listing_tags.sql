-- MrSa Properties: separate listing tags from physical property types.
-- Run once in Supabase Dashboard > SQL Editor after merging this change.
alter table public.listings
  add column if not exists listing_tag text;

-- Preserve existing New Launch listings as tagged listings.
update public.listings
set listing_tag = 'New Launch'
where property_type = 'New Launch'
  and (listing_tag is null or listing_tag = '');

alter table public.listings
  drop constraint if exists listings_listing_tag_check;

alter table public.listings
  add constraint listings_listing_tag_check
  check (listing_tag is null or listing_tag in ('New Launch'));

create index if not exists listings_approved_tag_idx
  on public.listings (listing_tag, created_at desc)
  where status = 'approved';
