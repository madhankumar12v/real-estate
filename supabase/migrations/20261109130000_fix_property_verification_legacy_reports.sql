-- P1 compatibility repair for databases where listing_reports already existed
-- before the newer property-verification migration.
-- Additive and idempotent: preserves all existing report rows.

begin;

alter table public.listing_reports
  add column if not exists reporter_name text,
  add column if not exists reporter_contact text,
  add column if not exists report_status text not null default 'open',
  add column if not exists admin_notes text,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- Preserve legacy report contact and review status when those fields exist.
update public.listing_reports
set reporter_contact = reporter_phone
where reporter_contact is null and reporter_phone is not null;

update public.listing_reports
set report_status = case status
  when 'reviewing' then 'investigating'
  when 'resolved' then 'resolved'
  when 'dismissed' then 'dismissed'
  else 'open'
end
where report_status = 'open';

-- Remove legacy permissive policy names so the current approved-listing
-- submission policy is the one that governs public reports.
drop policy if exists "public submit listing reports" on public.listing_reports;
drop policy if exists "admins manage listing reports" on public.listing_reports;
drop policy if exists "listing_reports_public_insert" on public.listing_reports;
drop policy if exists "listing_reports_admin_manage" on public.listing_reports;

drop policy if exists "Anyone can submit a report for an approved listing" on public.listing_reports;
create policy "Anyone can submit a report for an approved listing"
  on public.listing_reports
  for insert to anon, authenticated
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.status = 'approved'
    )
    and length(trim(reason)) > 0
    and (details is null or length(details) <= 2000)
    and (reporter_name is null or length(reporter_name) <= 120)
    and (reporter_contact is null or length(reporter_contact) <= 80)
  );

drop policy if exists "Admins review listing reports" on public.listing_reports;
create policy "Admins review listing reports"
  on public.listing_reports
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Table grants are required in addition to RLS policies.
grant insert (listing_id, reason, details, reporter_name, reporter_contact)
  on table public.listing_reports to anon, authenticated;
grant select, delete on table public.listing_reports to authenticated;
grant update (report_status, reviewed_by, reviewed_at, admin_notes)
  on table public.listing_reports to authenticated;

grant select, insert, update, delete
  on table public.listing_verifications,
         public.listing_verification_checks,
         public.listing_documents
  to authenticated;

grant select on table public.listing_trust_badges to anon, authenticated;
grant insert, update, delete on table public.listing_trust_badges to authenticated;

-- The original migration stopped before reaching its storage section.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-documents', 'listing-documents', false, 10485760, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "Admins read private listing documents" on storage.objects;
create policy "Admins read private listing documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'listing-documents' and public.is_admin());

drop policy if exists "Admins upload private listing documents" on storage.objects;
create policy "Admins upload private listing documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-documents' and public.is_admin());

drop policy if exists "Admins delete private listing documents" on storage.objects;
create policy "Admins delete private listing documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'listing-documents' and public.is_admin());

commit;
