-- MrSa daily social draft generation with a 7-day per-platform repeat cooldown.
-- Runs from the Cloudflare Worker at 10:00 Asia/Kolkata. Drafts always require explicit admin approval.
-- A listing can have multiple historical auto-generated posts; remove the old one-auto-post-per-listing uniqueness guards.
drop index if exists public.facebook_posts_one_auto_per_listing;
drop index if exists public.instagram_posts_one_auto_per_listing;

create or replace function public.generate_daily_social_drafts()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_facebook_created integer := 0;
  v_instagram_created integer := 0;
  v_now timestamptz := now();
begin
  -- Serialize the daily batch so duplicate cron deliveries cannot create duplicate drafts.
  perform pg_advisory_xact_lock(hashtext('mrsa_daily_social_draft_batch'));

  insert into public.facebook_posts
    (listing_id, caption, image_url, status, created_by, auto_generated,
     attempt_count, next_attempt_at, approved_by, approved_at)
  select
    l.id,
    left(
      coalesce(nullif(btrim(l.title), ''), 'Property for sale')
      || E'\n' || coalesce(l.property_type, 'Property') || ' for sale in '
      || coalesce(nullif(concat_ws(', ', nullif(btrim(l.locality), ''),
          nullif(btrim(l.city), ''), nullif(btrim(l.district), '')), ''), 'Tamil Nadu')
      || E'\nRate: ' || case when l.price_per_sqft is null then 'Price on request'
        else '₹' || to_char(l.price_per_sqft, 'FM999,999,999,990.##') || ' per sq.ft.' end
      || E'\n\nவேலூர், காட்பாடி, குடியாத்தம், ராணிப்பேட்டை, ஆற்காடு, அணைக்கட்டு, வாலாஜா பகுதிகளில் உங்கள் அடுத்த சொத்து வாய்ப்பை MrSa Properties உடன் கண்டறியுங்கள். மேலும் விவரங்கள் மற்றும் பார்வைக்கு எங்களைத் தொடர்புகொள்ளுங்கள்.'
      || E'\n\nProperty details are shared as provided in the listing. Please verify title, approvals and documents independently.'
      || E'\n\n#MrSaProperties #VelloreRealEstate #PropertyForSale',
      5000
    ),
    photo.url,
    'draft',
    l.user_id,
    true,
    0,
    v_now,
    null,
    null
  from public.listings l
  join lateral (
    select li.url
    from public.listing_images li
    where li.listing_id = l.id
      and li.url ~* '^https://'
    order by li.position asc, li.id asc
    limit 1
  ) photo on true
  where l.status = 'approved'
    and not exists (
      select 1 from public.facebook_posts p
      where p.listing_id = l.id
        and p.status in ('draft', 'approved', 'publishing', 'review_required')
    )
    and not exists (
      select 1 from public.facebook_posts p
      where p.listing_id = l.id
        and greatest(p.created_at, coalesce(p.published_at, p.created_at)) > v_now - interval '7 days'
    );
  get diagnostics v_facebook_created = row_count;

  insert into public.instagram_posts
    (listing_id, caption, image_url, status, created_by, auto_generated,
     attempt_count, next_attempt_at, approved_by, approved_at)
  select
    l.id,
    left(
      coalesce(nullif(btrim(l.title), ''), 'Property for sale')
      || E'\n' || coalesce(l.property_type, 'Property') || ' for sale in '
      || coalesce(nullif(concat_ws(', ', nullif(btrim(l.locality), ''),
          nullif(btrim(l.city), ''), nullif(btrim(l.district), '')), ''), 'Tamil Nadu')
      || E'\nRate: ' || case when l.price_per_sqft is null then 'Price on request'
        else '₹' || to_char(l.price_per_sqft, 'FM999,999,999,990.##') || ' per sq.ft.' end
      || E'\n\nவேலூர், காட்பாடி, குடியாத்தம், ராணிப்பேட்டை, ஆற்காடு, அணைக்கட்டு, வாலாஜா பகுதிகளில் உங்கள் அடுத்த சொத்து வாய்ப்பை MrSa Properties உடன் கண்டறியுங்கள். மேலும் விவரங்கள் மற்றும் பார்வைக்கு எங்களைத் தொடர்புகொள்ளுங்கள்.'
      || E'\n\nProperty details are shared as provided in the listing. Please verify title, approvals and documents independently.'
      || E'\n\n#MrSaProperties #VelloreRealEstate #PropertyForSale',
      2200
    ),
    photo.url,
    'draft',
    l.user_id,
    true,
    0,
    v_now,
    null,
    null
  from public.listings l
  join lateral (
    select li.url
    from public.listing_images li
    where li.listing_id = l.id
      and li.url ~* '^https://'
    order by li.position asc, li.id asc
    limit 1
  ) photo on true
  where l.status = 'approved'
    and not exists (
      select 1 from public.instagram_posts p
      where p.listing_id = l.id
        and p.status in ('draft', 'approved', 'publishing', 'review_required')
    )
    and not exists (
      select 1 from public.instagram_posts p
      where p.listing_id = l.id
        and greatest(p.created_at, coalesce(p.published_at, p.created_at)) > v_now - interval '7 days'
    );
  get diagnostics v_instagram_created = row_count;

  return jsonb_build_object(
    'facebook_created', v_facebook_created,
    'instagram_created', v_instagram_created,
    'repeat_cooldown_days', 7,
    'review_required', true,
    'generated_at', v_now
  );
end;
$$;

revoke all on function public.generate_daily_social_drafts() from public, anon, authenticated;
grant execute on function public.generate_daily_social_drafts() to service_role;

comment on function public.generate_daily_social_drafts() is
  'Creates separate unapproved Facebook and Instagram drafts for approved properties with a public HTTPS photo, no open draft, and at least seven days since the latest post record for that platform.';
