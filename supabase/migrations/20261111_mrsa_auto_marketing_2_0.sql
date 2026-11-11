-- MrSa Auto Marketing 2.0
-- Automatically enqueue Facebook + Instagram posts after an administrator approves a listing.
-- The Cloudflare scheduled Worker publishes approved queue items only while the master switch is enabled.

create table if not exists public.social_automation_settings (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.social_automation_settings (id, enabled)
values (1, false)
on conflict (id) do nothing;

alter table public.social_automation_settings enable row level security;
revoke all on public.social_automation_settings from anon;
grant select, update on public.social_automation_settings to authenticated;
drop policy if exists "social automation admin read" on public.social_automation_settings;
create policy "social automation admin read" on public.social_automation_settings
  for select to authenticated using (public.is_admin());
drop policy if exists "social automation admin update" on public.social_automation_settings;
create policy "social automation admin update" on public.social_automation_settings
  for update to authenticated using (public.is_admin())
  with check (public.is_admin() and (updated_by is null or updated_by = auth.uid()));

alter table public.facebook_posts
  add column if not exists auto_generated boolean not null default false,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists last_attempt_at timestamptz,
  add column if not exists processing_started_at timestamptz;
alter table public.instagram_posts
  add column if not exists auto_generated boolean not null default false,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz not null default now(),
  add column if not exists last_attempt_at timestamptz,
  add column if not exists processing_started_at timestamptz;

create unique index if not exists facebook_posts_one_auto_per_listing
  on public.facebook_posts(listing_id) where auto_generated = true;
create unique index if not exists instagram_posts_one_auto_per_listing
  on public.instagram_posts(listing_id) where auto_generated = true;
create index if not exists facebook_posts_auto_due_idx
  on public.facebook_posts(status, next_attempt_at, created_at) where auto_generated = true;
create index if not exists instagram_posts_auto_due_idx
  on public.instagram_posts(status, next_attempt_at, created_at) where auto_generated = true;

create or replace function public.enqueue_social_posts_after_listing_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_enabled boolean := false;
  v_image_url text;
  v_place text;
  v_rate text;
  v_caption text;
  v_approver uuid;
begin
  if new.status <> 'approved' or old.status is not distinct from new.status then
    return new;
  end if;

  select enabled into v_enabled
  from public.social_automation_settings
  where id = 1;

  if not coalesce(v_enabled, false) then
    return new;
  end if;

  select li.url into v_image_url
  from public.listing_images li
  where li.listing_id = new.id
  order by li.position asc, li.id asc
  limit 1;

  -- Do not create a post that Meta cannot render without a public property photo.
  if v_image_url is null or v_image_url !~* '^https://'
     then return new;
  end if;

  v_place := concat_ws(', ', nullif(btrim(new.locality), ''),
    nullif(btrim(new.city), ''), nullif(btrim(new.district), ''));
  v_rate := case when new.price_per_sqft is null
    then 'Price on request'
    else '₹' || to_char(new.price_per_sqft, 'FM999,999,999,990.##') || ' per sq.ft.'
  end;
  v_caption := coalesce(nullif(btrim(new.title), ''), 'Property for sale')
    || E'\n' || coalesce(new.property_type, 'Property') || ' for sale in ' || v_place
    || E'\nRate: ' || v_rate
    || E'\n\nவேலூர், காட்பாடி, குடியாத்தம், ராணிப்பேட்டை, ஆற்காடு, அணைக்கட்டு, வாலாஜா பகுதிகளில் உங்கள் அடுத்த சொத்து வாய்ப்பை MrSa Properties உடன் கண்டறியுங்கள். மேலும் விவரங்கள் மற்றும் பார்வைக்கு எங்களைத் தொடர்புகொள்ளுங்கள்.'
    || E'\n\nProperty details are shared as provided in the listing. Please verify title, approvals and documents independently.'
    || E'\n\n#MrSaProperties #VelloreRealEstate #PropertyForSale';
  v_approver := coalesce(auth.uid(), new.user_id);

  insert into public.facebook_posts
    (listing_id, caption, image_url, status, created_by, approved_by, approved_at,
     auto_generated, next_attempt_at)
  values
    (new.id, left(v_caption, 5000), v_image_url, 'approved', new.user_id,
     v_approver, now(), true, now())
  on conflict (listing_id) where auto_generated = true do nothing;

  insert into public.instagram_posts
    (listing_id, caption, image_url, status, created_by, approved_by, approved_at,
     auto_generated, next_attempt_at)
  values
    (new.id, left(v_caption, 2200), v_image_url, 'approved', new.user_id,
     v_approver, now(), true, now())
  on conflict (listing_id) where auto_generated = true do nothing;

  return new;
end;
$$;

drop trigger if exists listings_enqueue_social_posts on public.listings;
create trigger listings_enqueue_social_posts
  after update of status on public.listings
  for each row execute function public.enqueue_social_posts_after_listing_approval();

comment on table public.social_automation_settings is
  'Admin-controlled master pause/resume switch for automatic social publishing. Disabled by default until Cloudflare secrets are configured.';
