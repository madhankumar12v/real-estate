-- MrSa Properties: property verification, private documents, public trust indicators and buyer reports.
-- Run this migration in Supabase SQL Editor before using the new verification screens.

create table if not exists public.listing_verifications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  review_status text not null default 'not_started'
    check (review_status in ('not_started','in_review','details_reviewed','documents_reviewed','site_visit_completed','needs_correction','rejected')),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_verification_checks (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  check_key text not null,
  check_label text not null,
  is_complete boolean not null default false,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  unique (listing_id, check_key)
);

create table if not exists public.listing_documents (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text,
  review_status text not null default 'received'
    check (review_status in ('received','reviewed','needs_replacement')),
  uploaded_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- This table contains only buyer-safe fields. Never put admin notes or document paths here.
create table if not exists public.listing_trust_badges (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  contact_checked boolean not null default false,
  location_checked boolean not null default false,
  photos_checked boolean not null default false,
  price_area_checked boolean not null default false,
  documents_reviewed boolean not null default false,
  site_visit_completed boolean not null default false,
  public_reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reason text not null check (reason in ('incorrect_information','duplicate_listing','suspicious_contact','property_unavailable','other')),
  details text,
  reporter_name text,
  reporter_contact text,
  report_status text not null default 'open' check (report_status in ('open','investigating','resolved','dismissed')),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists listing_verifications_status_idx on public.listing_verifications(review_status, updated_at desc);
create index if not exists listing_documents_listing_idx on public.listing_documents(listing_id, created_at desc);
create index if not exists listing_reports_status_idx on public.listing_reports(report_status, created_at desc);

alter table public.listing_verifications enable row level security;
alter table public.listing_verification_checks enable row level security;
alter table public.listing_documents enable row level security;
alter table public.listing_trust_badges enable row level security;
alter table public.listing_reports enable row level security;

drop policy if exists "Admins manage listing verifications" on public.listing_verifications;
create policy "Admins manage listing verifications" on public.listing_verifications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage listing verification checks" on public.listing_verification_checks;
create policy "Admins manage listing verification checks" on public.listing_verification_checks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage listing documents" on public.listing_documents;
create policy "Admins manage listing documents" on public.listing_documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Public read trust badges for approved listings" on public.listing_trust_badges;
create policy "Public read trust badges for approved listings" on public.listing_trust_badges
  for select to anon, authenticated using (
    exists (select 1 from public.listings l where l.id = listing_id and l.status = 'approved')
  );
drop policy if exists "Admins manage listing trust badges" on public.listing_trust_badges;
create policy "Admins manage listing trust badges" on public.listing_trust_badges
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Anyone can submit a report for an approved listing" on public.listing_reports;
create policy "Anyone can submit a report for an approved listing" on public.listing_reports
  for insert to anon, authenticated with check (
    exists (select 1 from public.listings l where l.id = listing_id and l.status = 'approved')
    and length(trim(reason)) > 0
    and (details is null or length(details) <= 2000)
    and (reporter_name is null or length(reporter_name) <= 120)
    and (reporter_contact is null or length(reporter_contact) <= 80)
  );
drop policy if exists "Admins review listing reports" on public.listing_reports;
create policy "Admins review listing reports" on public.listing_reports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-documents','listing-documents',false,10485760,array[
  'application/pdf','image/jpeg','image/png','image/webp'
])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp'];

drop policy if exists "Admins read private listing documents" on storage.objects;
create policy "Admins read private listing documents" on storage.objects
  for select to authenticated using (bucket_id = 'listing-documents' and public.is_admin());
drop policy if exists "Admins upload private listing documents" on storage.objects;
create policy "Admins upload private listing documents" on storage.objects
  for insert to authenticated with check (bucket_id = 'listing-documents' and public.is_admin());
drop policy if exists "Admins delete private listing documents" on storage.objects;
create policy "Admins delete private listing documents" on storage.objects
  for delete to authenticated using (bucket_id = 'listing-documents' and public.is_admin());
