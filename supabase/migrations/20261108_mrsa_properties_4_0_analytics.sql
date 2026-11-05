-- MrSa Properties 4.0 CRM analytics performance indexes
-- Run once after the Phase 1/Phase 3 hardening migration.
-- This migration adds indexes only; it does not delete or rewrite existing records.

create index if not exists enquiries_created_at_desc_idx
  on public.enquiries (created_at desc);

create index if not exists enquiries_source_created_at_idx
  on public.enquiries (source, created_at desc);

create index if not exists enquiries_listing_created_at_idx
  on public.enquiries (listing_id, created_at desc);

create index if not exists enquiries_assigned_created_at_idx
  on public.enquiries (assigned_to, created_at desc);

create index if not exists listings_district_property_type_idx
  on public.listings (district, property_type)
  where status = 'approved';

analyze public.enquiries;
analyze public.listings;
