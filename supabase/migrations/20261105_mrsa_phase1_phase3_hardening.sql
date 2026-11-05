-- MrSa Properties: Phase 1 security hardening + Phase 3 CRM audit trail
-- Run AFTER 20261106_mrsa_properties_3_0.sql in Supabase SQL Editor.
-- This migration is intentionally separate from the base schema so existing data is preserved.

do $$
begin
  if to_regclass('public.enquiries') is null then
    raise exception 'public.enquiries is missing. Run the MrSa Properties 3.0 migration first.';
  end if;
  if to_regclass('public.listing_reports') is null then
    raise exception 'public.listing_reports is missing. Run the MrSa Properties 3.0 migration first.';
  end if;
end $$;

-- Add CRM follow-up reminders without changing existing lead data.
alter table public.enquiries add column if not exists follow_up_at timestamptz;
create index if not exists enquiries_follow_up_due_idx
  on public.enquiries(follow_up_at) where follow_up_at is not null and status not in ('closed','not_interested');

-- Remove broad table and column grants previously given to anon/authenticated.
revoke all privileges on table public.enquiries from anon, authenticated;
revoke all privileges (id, listing_id, buyer_user_id, buyer_name, buyer_email, buyer_phone, message, status, assigned_to, source, created_at, updated_at)
  on table public.enquiries from anon, authenticated;

revoke all privileges on table public.listing_reports from anon, authenticated;
revoke all privileges (id, listing_id, reporter_user_id, reporter_name, reporter_phone, reason, details, status, created_at)
  on table public.listing_reports from anon, authenticated;

-- Public visitors may submit enquiries, but cannot read or edit them.
-- CRM staff can read assigned enquiries; admins can read all enquiries.
grant insert (listing_id, buyer_user_id, buyer_name, buyer_email, buyer_phone, message, source)
  on table public.enquiries to anon, authenticated;
grant select on table public.enquiries to authenticated;
grant update (status, updated_at, assigned_to, follow_up_at) on table public.enquiries to authenticated;

-- Public visitors may submit reports. Only admins can read, update or delete them.
grant insert (listing_id, reporter_user_id, reporter_name, reporter_phone, reason, details)
  on table public.listing_reports to anon, authenticated;
grant select, delete on table public.listing_reports to authenticated;
grant update (status) on table public.listing_reports to authenticated;

alter table public.enquiries enable row level security;
alter table public.listing_reports enable row level security;

-- Rebuild policies with explicit role and row boundaries.
drop policy if exists "public create enquiries" on public.enquiries;
drop policy if exists "crm staff read enquiries" on public.enquiries;
drop policy if exists "crm staff update enquiries" on public.enquiries;
drop policy if exists "enquiries_public_insert" on public.enquiries;
drop policy if exists "enquiries_staff_select" on public.enquiries;
drop policy if exists "enquiries_staff_update" on public.enquiries;

create policy "enquiries_public_insert"
on public.enquiries for insert to anon, authenticated
with check (
  status = 'new'
  and assigned_to is null
  and (buyer_user_id is null or buyer_user_id = auth.uid())
  and length(trim(buyer_name)) between 2 and 100
  and length(regexp_replace(coalesce(buyer_phone, ''), '[^0-9]', '', 'g')) between 7 and 15
  and (listing_id is null or exists (
    select 1 from public.listings l
    where l.id = listing_id and l.status = 'approved'
  ))
);

create policy "enquiries_staff_select"
on public.enquiries for select to authenticated
using (
  public.is_admin()
  or (
    assigned_to = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agent')
  )
);

create policy "enquiries_staff_update"
on public.enquiries for update to authenticated
using (
  public.is_admin()
  or (
    assigned_to = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agent')
  )
)
with check (
  public.is_admin()
  or (
    assigned_to = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'agent')
  )
);

drop policy if exists "public submit listing reports" on public.listing_reports;
drop policy if exists "admins manage listing reports" on public.listing_reports;
drop policy if exists "listing_reports_public_insert" on public.listing_reports;
drop policy if exists "listing_reports_admin_manage" on public.listing_reports;

create policy "listing_reports_public_insert"
on public.listing_reports for insert to anon, authenticated
with check (
  status = 'open'
  and (reporter_user_id is null or reporter_user_id = auth.uid())
  and length(trim(reason)) between 3 and 100
  and (listing_id is not null and exists (
    select 1 from public.listings l
    where l.id = listing_id and l.status = 'approved'
  ))
);

create policy "listing_reports_admin_manage"
on public.listing_reports for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- A non-admin agent may update lead status, but cannot reassign a lead or alter buyer details.
create or replace function public.mrsa_protect_enquiry_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      if new.status <> 'new' or new.assigned_to is not null then
        raise exception 'New enquiries must start unassigned with status new.';
      end if;
      if new.buyer_user_id is distinct from auth.uid() then
        raise exception 'Invalid enquiry user.';
      end if;
      if new.listing_id is not null and not exists (
        select 1 from public.listings l where l.id = new.listing_id and l.status = 'approved'
      ) then
        raise exception 'Enquiries can only be created for published properties.';
      end if;
    end if;
  else
    if new.assigned_to is distinct from old.assigned_to and not public.is_admin() then
      raise exception 'Only an administrator can assign or reassign enquiries.';
    end if;
    if new.assigned_to is not null and not exists (
      select 1 from public.profiles p where p.id = new.assigned_to and p.role = 'agent'
    ) then
      raise exception 'Enquiries can only be assigned to active agent profiles.';
    end if;
    if new.buyer_user_id is distinct from old.buyer_user_id
       or new.buyer_name is distinct from old.buyer_name
       or new.buyer_email is distinct from old.buyer_email
       or new.buyer_phone is distinct from old.buyer_phone
       or new.message is distinct from old.message
       or new.listing_id is distinct from old.listing_id then
      raise exception 'Buyer and enquiry details cannot be changed from the CRM.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists mrsa_protect_enquiry_changes on public.enquiries;
create trigger mrsa_protect_enquiry_changes
before insert or update on public.enquiries
for each row execute function public.mrsa_protect_enquiry_changes();

-- Audit trail: record metadata only (never copy buyer phone, email or message into the log).
create table if not exists public.admin_activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null check (entity_type in ('listing','enquiry','listing_report')),
  record_id uuid not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_activity_logs_created_at_idx
  on public.admin_activity_logs(created_at desc);
create index if not exists admin_activity_logs_entity_idx
  on public.admin_activity_logs(entity_type, record_id);

alter table public.admin_activity_logs enable row level security;
revoke all privileges on table public.admin_activity_logs from anon, authenticated;
grant select on table public.admin_activity_logs to authenticated;
drop policy if exists "admins read activity logs" on public.admin_activity_logs;
create policy "admins read activity logs"
on public.admin_activity_logs for select to authenticated
using (public.is_admin());

create or replace function public.mrsa_write_activity_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  row_data jsonb;
  row_id uuid;
  entity text;
  detail_data jsonb;
begin
  if tg_op = 'DELETE' then
    row_data := to_jsonb(old);
  else
    row_data := to_jsonb(new);
  end if;

  row_id := (row_data ->> 'id')::uuid;
  entity := case tg_table_name
    when 'listings' then 'listing'
    when 'enquiries' then 'enquiry'
    else 'listing_report'
  end;

  detail_data := jsonb_strip_nulls(jsonb_build_object(
    'status', row_data -> 'status',
    'assigned_to', row_data -> 'assigned_to',
    'follow_up_at', row_data -> 'follow_up_at',
    'title', row_data -> 'title'
  ));

  insert into public.admin_activity_logs(actor_id, entity_type, record_id, action, details)
  values (auth.uid(), entity, row_id, tg_op, detail_data);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists mrsa_activity_listings on public.listings;
create trigger mrsa_activity_listings
after insert or update or delete on public.listings
for each row execute function public.mrsa_write_activity_log();

drop trigger if exists mrsa_activity_enquiries on public.enquiries;
create trigger mrsa_activity_enquiries
after insert or update or delete on public.enquiries
for each row execute function public.mrsa_write_activity_log();

drop trigger if exists mrsa_activity_listing_reports on public.listing_reports;
create trigger mrsa_activity_listing_reports
after insert or update or delete on public.listing_reports
for each row execute function public.mrsa_write_activity_log();

comment on table public.admin_activity_logs is
  'Admin-only audit metadata for listing, enquiry and listing-report changes. Contains no buyer contact details.';
