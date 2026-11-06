-- Add an optional public logo URL for each Channel Partner.
-- Existing partner records remain valid; cards show a neutral fallback until a logo is added.
alter table public.partners
  add column if not exists logo_url text;
