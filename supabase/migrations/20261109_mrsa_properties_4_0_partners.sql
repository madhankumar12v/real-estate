-- MrSa Properties 4.0 partner directory and shared partner workspace
-- Additive migration: preserves existing users, listings and enquiries.
begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('buyer','owner','agent','partner','admin'));

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.partners (name, slug) values
  ('VIP Housing & Property', 'vip-housing-property'),
  ('VIP City', 'vip-city'),
  ('Grande Realtors', 'grande-realtors'),
  ('TGP', 'tgp'),
  ('VP Real Estate and Promoters', 'vp-real-estate-and-promoters'),
  ('Capital Housing & Property', 'capital-housing-property'),
  ('Gubra', 'gubra'),
  ('Spark Reality', 'spark-reality'),
  ('Delight Homes Promoters', 'delight-homes-promoters'),
  ('NKB Housing & Property', 'nkb-housing-property')
on conflict (slug) do update set name = excluded.name;

alter table public.listings
  add column if not exists partner_id uuid references public.partners(id) on delete set null;

create index if not exists listings_partner_status_created_idx
  on public.listings (partner_id, status, created_at desc);

alter table public.partners enable row level security;

grant select, insert, update, delete on public.partners to authenticated;

drop policy if exists "partners authenticated read" on public.partners;
create policy "partners authenticated read"
  on public.partners for select to authenticated using (true);

drop policy if exists "partners admin manage" on public.partners;
create policy "partners admin manage"
  on public.partners for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Partner role is assigned only by an administrator in Supabase.
-- The existing listing policies continue to require authenticated ownership
-- for submissions and admin authority for publication/approval.
create or replace function public.validate_partner_listing_attribution()
returns trigger language plpgsql set search_path = public
as $partner$
begin
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'partner') then
    if new.partner_id is null or not exists (
      select 1 from public.partners where id = new.partner_id and is_active = true
    ) then
      raise exception 'Select an active partner before submitting this property.';
    end if;
  end if;
  return new;
end;
$partner$;

drop trigger if exists validate_partner_listing_attribution on public.listings;
create trigger validate_partner_listing_attribution
  before insert or update of partner_id on public.listings
  for each row execute procedure public.validate_partner_listing_attribution();

comment on column public.listings.partner_id is
  'Partner attribution selected at submission; shared partner login means attribution is user-entered, not individual authentication.';

commit;
