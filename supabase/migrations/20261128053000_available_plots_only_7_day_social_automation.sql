-- MrSa: enforce the approved, available-plot-only 7-day automatic publishing rule.
-- This migration changes functions only. It does not update, delete, retry, or
-- otherwise rewrite existing Facebook/Instagram queue or history rows.

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
  perform pg_advisory_xact_lock(hashtext('mrsa_daily_social_draft_batch'));

  insert into public.facebook_posts
    (listing_id, caption, image_url, status, created_by, auto_generated,
     attempt_count, next_attempt_at, approved_by, approved_at)
  select
    l.id,
    left(
      coalesce(nullif(btrim(l.title), ''), 'Property for sale')
      || E'\n' || coalesce(l.property_type, 'Plot') || ' for sale in '
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
    and l.property_type = 'Plot'
    and exists (
      select 1 from public.plot_availability pa
      where pa.listing_id = l.id and pa.available_count > 0
    )
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
      || E'\n' || coalesce(l.property_type, 'Plot') || ' for sale in '
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
    and l.property_type = 'Plot'
    and exists (
      select 1 from public.plot_availability pa
      where pa.listing_id = l.id and pa.available_count > 0
    )
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
    'eligible_rule', 'approved_plot_with_available_count_gt_zero',
    'repeat_cooldown_days', 7,
    'review_required', false,
    'generated_at', v_now
  );
end;
$$;

revoke all on function public.generate_daily_social_drafts() from public, anon, authenticated;
grant execute on function public.generate_daily_social_drafts() to service_role;

create or replace function public.enqueue_social_posts_after_listing_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_image_url text;
  v_place text;
  v_rate text;
  v_caption text;
  v_local_now timestamp without time zone;
  v_next_daily_local timestamp without time zone;
  v_next_daily_at timestamptz;
  v_fb_last_at timestamptz;
  v_ig_last_at timestamptz;
  v_fb_due_at timestamptz;
  v_ig_due_at timestamptz;
begin
  if new.status is distinct from 'approved'
     or old.status is not distinct from new.status then
    return new;
  end if;

  if new.property_type is distinct from 'Plot'
     or not exists (
       select 1 from public.plot_availability pa
       where pa.listing_id = new.id and pa.available_count > 0
     ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('mrsa_daily_social_draft_batch'));

  select li.url
    into v_image_url
  from public.listing_images li
  where li.listing_id = new.id
    and li.url ~* '^https://'
  order by li.position asc, li.id asc
  limit 1;

  if v_image_url is null or btrim(v_image_url) = '' then
    return new;
  end if;

  v_local_now := now() at time zone 'Asia/Kolkata';
  v_next_daily_local := date_trunc('day', v_local_now) + interval '10 hours';
  if v_local_now >= v_next_daily_local then
    v_next_daily_local := v_next_daily_local + interval '1 day';
  end if;
  v_next_daily_at := v_next_daily_local at time zone 'Asia/Kolkata';

  v_place := coalesce(
    nullif(concat_ws(', ',
      nullif(btrim(new.locality), ''),
      nullif(btrim(new.city), ''),
      nullif(btrim(new.district), '')
    ), ''),
    'Tamil Nadu'
  );

  v_rate := case
    when new.price_per_sqft is null then 'Price on request'
    else '₹' || to_char(new.price_per_sqft, 'FM999,999,999,990.##') || ' per sq.ft.'
  end;

  v_caption :=
    coalesce(nullif(btrim(new.title), ''), 'Property for sale') || E'\n' ||
    'Plot for sale in ' || v_place || E'\n' ||
    'Rate: ' || v_rate || E'\n\n' ||
    'வேலூர், காட்பாடி, குடியாத்தம், ராணிப்பேட்டை, ஆற்காடு, அணைக்கட்டு, வாலாஜா பகுதிகளில் உங்கள் அடுத்த சொத்து வாய்ப்பை MrSa Properties உடன் கண்டறியுங்கள். மேலும் விவரங்கள் மற்றும் பார்வைக்கு எங்களைத் தொடர்புகொள்ளுங்கள்.' || E'\n\n' ||
    'Property details are shared as provided in the listing. Please verify title, approvals and documents independently.' || E'\n\n' ||
    '#MrSaProperties #VelloreRealEstate #PropertyForSale';

  select max(greatest(p.created_at, coalesce(p.published_at, p.created_at)))
    into v_fb_last_at
  from public.facebook_posts p
  where p.listing_id = new.id and p.auto_generated is true;

  select max(greatest(p.created_at, coalesce(p.published_at, p.created_at)))
    into v_ig_last_at
  from public.instagram_posts p
  where p.listing_id = new.id and p.auto_generated is true;

  v_fb_due_at := greatest(v_next_daily_at, coalesce(v_fb_last_at + interval '7 days', v_next_daily_at));
  v_ig_due_at := greatest(v_next_daily_at, coalesce(v_ig_last_at + interval '7 days', v_next_daily_at));

  insert into public.facebook_posts
    (listing_id, caption, image_url, status, created_by, auto_generated,
     attempt_count, next_attempt_at, approved_by, approved_at)
  select new.id, left(v_caption, 5000), v_image_url, 'draft', new.user_id,
         true, 0, v_fb_due_at, null, null
  where not exists (
    select 1 from public.facebook_posts p
    where p.listing_id = new.id and p.auto_generated is true
      and p.status in ('draft', 'approved', 'publishing', 'review_required')
  );

  insert into public.instagram_posts
    (listing_id, caption, image_url, status, created_by, auto_generated,
     attempt_count, next_attempt_at, approved_by, approved_at)
  select new.id, left(v_caption, 2200), v_image_url, 'draft', new.user_id,
         true, 0, v_ig_due_at, null, null
  where not exists (
    select 1 from public.instagram_posts p
    where p.listing_id = new.id and p.auto_generated is true
      and p.status in ('draft', 'approved', 'publishing', 'review_required')
  );

  return new;
end;
$$;

drop trigger if exists listings_queue_social_posts_after_approval on public.listings;
drop trigger if exists listings_enqueue_social_posts_after_approval on public.listings;
drop trigger if exists listings_enqueue_social_posts on public.listings;

create trigger listings_queue_social_posts_after_approval
after update of status on public.listings
for each row
when (new.status = 'approved' and old.status is distinct from new.status)
execute function public.enqueue_social_posts_after_listing_approval();

comment on function public.generate_daily_social_drafts() is
  'Creates automatic Facebook and Instagram drafts only for approved Plot listings with available_count > 0, public HTTPS photos, no open auto queue row, and at least seven days since the latest auto post record for that platform.';

comment on function public.enqueue_social_posts_after_listing_approval() is
  'Queues automatic Facebook and Instagram posts only after website admin approval, for Plot listings with available_count > 0. No separate social approval is required; per-platform seven-day cooldown applies.';
