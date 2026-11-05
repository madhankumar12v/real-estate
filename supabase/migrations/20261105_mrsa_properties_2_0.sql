-- MrSa Properties 2.0 migration
-- Run once in Supabase Dashboard > SQL Editor after reviewing the existing schema.
-- This aligns database property types with the categories used by the website.
alter table public.listings drop constraint if exists listings_property_type_check;
alter table public.listings add constraint listings_property_type_check
  check (property_type in ('New Launch','Commercial','Plot','Land','Villa','Apartment','Independent House'));

-- Improve common public listing and admin dashboard queries.
create index if not exists listings_approved_created_at_idx
  on public.listings (created_at desc) where status = 'approved';
create index if not exists listings_approved_price_idx
  on public.listings (price asc) where status = 'approved';
create index if not exists listings_district_type_idx
  on public.listings (district, property_type) where status = 'approved';
create index if not exists listings_owner_created_at_idx
  on public.listings (user_id, created_at desc);
create index if not exists listing_images_listing_position_idx
  on public.listing_images (listing_id, position);
