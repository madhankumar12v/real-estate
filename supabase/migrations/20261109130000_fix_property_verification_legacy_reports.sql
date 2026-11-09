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

commit;
