-- MrSa Properties: private loan enquiry capture and admin-only management.
create table if not exists public.loan_enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  loan_type text not null,
  employment_type text not null check (employment_type in ('Salaried','Self-Employed')),
  monthly_income numeric(14,2) not null check (monthly_income >= 0),
  existing_emis numeric(14,2) not null default 0 check (existing_emis >= 0),
  requested_amount numeric(14,2) check (requested_amount is null or requested_amount > 0),
  preferred_location text not null,
  estimated_eligible_amount numeric(14,2) not null default 0 check (estimated_eligible_amount >= 0),
  eligibility_interest_rate numeric(5,2) not null default 9,
  eligibility_tenure_years integer not null default 20,
  consent_to_contact boolean not null default false,
  consent_to_share boolean not null default false,
  status text not null default 'new'
    check (status in ('new','contacted','interested','application_in_progress','closed','not_interested')),
  admin_notes text
);

create index if not exists loan_enquiries_created_at_idx on public.loan_enquiries (created_at desc);
create index if not exists loan_enquiries_status_created_at_idx on public.loan_enquiries (status, created_at desc);

alter table public.loan_enquiries enable row level security;

drop policy if exists "loan enquiries submit with consent" on public.loan_enquiries;
create policy "loan enquiries submit with consent"
on public.loan_enquiries for insert to anon, authenticated
with check (consent_to_contact = true and consent_to_share = true);

drop policy if exists "admins read loan enquiries" on public.loan_enquiries;
create policy "admins read loan enquiries"
on public.loan_enquiries for select to authenticated
using (public.is_admin());

drop policy if exists "admins update loan enquiries" on public.loan_enquiries;
create policy "admins update loan enquiries"
on public.loan_enquiries for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins delete loan enquiries" on public.loan_enquiries;
create policy "admins delete loan enquiries"
on public.loan_enquiries for delete to authenticated
using (public.is_admin());

grant insert on public.loan_enquiries to anon, authenticated;
grant select, update, delete on public.loan_enquiries to authenticated;
