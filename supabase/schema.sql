-- Run this entire script in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'buyer' check (role in ('buyer','owner','agent','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  property_type text not null check (property_type in ('Apartment','Independent House','Villa','Plot','Commercial')),
  district text not null,
  city text not null,
  locality text,
  price numeric(14,2),
  price_per_sqft numeric(12,2) check (price_per_sqft is null or price_per_sqft >= 0),
  area_sqft numeric(12,2),
  bedrooms integer,
  bathrooms integer,
  facing text,
  description text,
  contact_whatsapp text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  url text not null,
  position integer not null default 0
);

-- Create a profile automatically on signup. Users cannot register themselves as admins.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    case when new.raw_user_meta_data->>'role' in ('owner','agent') then new.raw_user_meta_data->>'role' else 'buyer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

-- Profiles: users can read/update only their own non-role fields.
drop policy if exists "profile read own" on public.profiles;
create policy "profile read own" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profile update own" on public.profiles;
create policy "profile update own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and role in ('buyer','owner','agent'));

-- Protect account roles from self-promotion through the public profile update API.
-- Manual admin promotion in the Supabase SQL editor remains possible.
create or replace function public.prevent_profile_role_escalation()
returns trigger language plpgsql security definer set search_path = public
as $
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only an administrator can change account roles.';
  end if;
  return new;
end;
$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles
for each row execute procedure public.prevent_profile_role_escalation();

-- Listings: public sees approved listings; owners see their own; admins see all.
drop policy if exists "approved listings public read" on public.listings;
create policy "approved listings public read" on public.listings for select using (status = 'approved' or user_id = auth.uid() or public.is_admin());
drop policy if exists "authenticated create own listing" on public.listings;
create policy "authenticated create own listing" on public.listings for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "owner update own listing" on public.listings;
create policy "owner update own listing" on public.listings for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check ((user_id = auth.uid() and status in ('pending','rejected')) or public.is_admin());
drop policy if exists "owner or admin delete listing" on public.listings;
create policy "owner or admin delete listing" on public.listings for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- Images: images of approved listings are public; listing owners/admin can manage.
drop policy if exists "listing images public read" on public.listing_images;
create policy "listing images public read" on public.listing_images for select using (
  exists(select 1 from public.listings l where l.id = listing_id and (l.status = 'approved' or l.user_id = auth.uid() or public.is_admin()))
);
drop policy if exists "listing owner add images" on public.listing_images;
create policy "listing owner add images" on public.listing_images for insert to authenticated with check (
  exists(select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  or public.is_admin()
);
drop policy if exists "listing owner delete images" on public.listing_images;
create policy "listing owner delete images" on public.listing_images for delete to authenticated using (
  exists(select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  or public.is_admin()
);

-- Create public bucket for property photos (no sensitive documents should be uploaded here).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-images','property-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "public view property photos" on storage.objects;
create policy "public view property photos" on storage.objects for select using (bucket_id = 'property-images');
drop policy if exists "users upload own property photos" on storage.objects;
create policy "users upload own property photos" on storage.objects for insert to authenticated with check (
  bucket_id = 'property-images' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "users delete own property photos" on storage.objects;
create policy "users delete own property photos" on storage.objects for delete to authenticated using (
  bucket_id = 'property-images' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

-- IMPORTANT: after creating your own account, promote it to admin manually:
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_EMAIL');
-- Never expose the Supabase service_role key in frontend code.

-- Safe aggregate-only statistics for the public homepage.
-- This function exposes counts only; it never returns listing or buyer details.
create or replace function public.get_public_homepage_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'total_properties', count(*)::bigint,
    'city_towns', count(distinct nullif(btrim(city), ''))::bigint,
    'recently_added', count(*) filter (where created_at >= now() - interval '30 days')::bigint
  )
  from public.listings
  where status = 'approved';
$$;

revoke all on function public.get_public_homepage_stats() from public;
grant execute on function public.get_public_homepage_stats() to anon, authenticated;
