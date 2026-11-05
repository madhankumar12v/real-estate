-- MrSa Properties 3.0: CRM, saved properties, verification and moderation
create table if not exists public.enquiries (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid references public.listings(id) on delete set null,
 buyer_user_id uuid references auth.users(id) on delete set null,
 buyer_name text not null, buyer_phone text not null, buyer_email text, message text,
 source text not null default 'website' check (source in ('website','property','whatsapp','phone','other')),
 status text not null default 'new' check (status in ('new','contacted','interested','closed','not_interested')),
 assigned_to uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists enquiries_status_created_idx on public.enquiries(status,created_at desc);
create index if not exists enquiries_assigned_idx on public.enquiries(assigned_to);
alter table public.enquiries enable row level security;
drop policy if exists "public create enquiries" on public.enquiries;
create policy "public create enquiries" on public.enquiries for insert with check (true);
drop policy if exists "crm staff read enquiries" on public.enquiries;
create policy "crm staff read enquiries" on public.enquiries for select to authenticated using (public.is_admin() or assigned_to=auth.uid());
drop policy if exists "crm staff update enquiries" on public.enquiries;
create policy "crm staff update enquiries" on public.enquiries for update to authenticated using (public.is_admin() or assigned_to=auth.uid()) with check (public.is_admin() or assigned_to=auth.uid());

create table if not exists public.saved_properties (
 user_id uuid not null references auth.users(id) on delete cascade,
 listing_id uuid not null references public.listings(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,listing_id)
);
alter table public.saved_properties enable row level security;
drop policy if exists "users manage own saved properties" on public.saved_properties;
create policy "users manage own saved properties" on public.saved_properties for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create table if not exists public.listing_reports (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.listings(id) on delete cascade,
 reporter_user_id uuid references auth.users(id) on delete set null,
 reporter_name text, reporter_phone text, reason text not null, details text,
 status text not null default 'open' check(status in ('open','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now()
);
alter table public.listing_reports enable row level security;
drop policy if exists "public submit listing reports" on public.listing_reports;
create policy "public submit listing reports" on public.listing_reports for insert with check(true);
drop policy if exists "admins manage listing reports" on public.listing_reports;
create policy "admins manage listing reports" on public.listing_reports for all to authenticated using(public.is_admin()) with check(public.is_admin());

create table if not exists public.property_verifications (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.listings(id) on delete cascade,
 submitted_by uuid not null references auth.users(id) on delete cascade,
 document_type text not null, notes text,
 status text not null default 'pending' check(status in ('pending','verified','rejected')),
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz, created_at timestamptz not null default now(), unique(listing_id)
);
alter table public.property_verifications enable row level security;
drop policy if exists "owners submit verification" on public.property_verifications;
create policy "owners submit verification" on public.property_verifications for insert to authenticated with check(submitted_by=auth.uid() and exists(select 1 from public.listings l where l.id=listing_id and l.user_id=auth.uid()));
drop policy if exists "owners and admins read verification" on public.property_verifications;
create policy "owners and admins read verification" on public.property_verifications for select to authenticated using(submitted_by=auth.uid() or public.is_admin());
drop policy if exists "admins review verification" on public.property_verifications;
create policy "admins review verification" on public.property_verifications for update to authenticated using(public.is_admin()) with check(public.is_admin());

create index if not exists listings_duplicate_lookup_idx on public.listings(lower(title),lower(city),price);
