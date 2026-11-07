-- MrSa Properties: replace district-based location with City + Town / Area.
-- Existing listing data is preserved. The legacy district column remains nullable for compatibility.
alter table public.listings alter column district drop not null;

create index if not exists listings_city_type_idx
  on public.listings (city, property_type) where status = 'approved';

create index if not exists listings_city_locality_idx
  on public.listings (city, locality);

comment on column public.listings.district is
  'Legacy location field retained for compatibility; the website now uses city and locality.';
comment on column public.listings.city is
  'City selected from the MrSa Properties location list.';
comment on column public.listings.locality is
  'Free-text town, village or area within the selected city.';
