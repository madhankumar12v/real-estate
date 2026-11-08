-- Store homepage enquiry form answers in dedicated columns.
-- Safe additive migration: existing enquiry rows and columns are preserved.
alter table public.enquiries
  add column if not exists city_town text,
  add column if not exists budget_range text,
  add column if not exists interest text,
  add column if not exists heard_about text;
