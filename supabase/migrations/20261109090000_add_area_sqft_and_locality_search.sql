-- MrSa Properties: optional property area and locality search index.
-- Safe for existing databases; preserves all current listing data.
alter table public.listings
  add column if not exists area_sqft numeric(12,2);

create index if not exists listings_approved_locality_idx
  on public.listings (lower(locality))
  where status = 'approved' and locality is not null;
