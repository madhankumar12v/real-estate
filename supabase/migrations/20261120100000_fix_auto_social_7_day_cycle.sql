-- MrSa Auto Marketing: make property approval join the existing 7-day cycle.
-- Automatic rows remain status='draft' for queue visibility, but the Worker
-- publishes auto_generated drafts without a separate social approval.
-- The first eligible slot is the next 10:00 IST daily batch, or the end of
-- the property's 7-day per-platform cooldown, whichever is later.

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

  -- Serialize this approval against the 10:00 IST backfill job so the same
  -- listing cannot be queued twice by the trigger and daily generator.
  perform pg_advisory_xact_lock(hashtext('mrsa_daily_social_draft_batch'));

  select li.url
    into v_image_url
  from public.listing_images li
  where li.listing_id = new.id
    and li.url ~* '^https://'
  order by li.position asc, li.id asc
  limit 1;

  -- The daily generator will pick this listing up once a public HTTPS photo
  -- exists, so a missing photo never causes a permanent skip.
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
    coalesce(new.property_type, 'Property') || ' for sale in ' || v_place || E'\n' ||
    'Rate: ' || v_rate || E'\n\n' ||
    'வேலூர், காட்பாடி, குடியாத்தம், ராணிப்பேட்டை, ஆற்காடு, அணைக்கட்டு, வாலாஜா பகுதிகளில் உங்கள் அடுத்த சொத்து வாய்ப்பை MrSa Properties உடன் கண்டறியுங்கள். மேலும் விவரங்கள் மற்றும் பார்வைக்கு எங்களைத் தொடர்புகொள்ளுங்கள்.' || E'\n\n' ||
    'Property details are shared as provided in the listing. Please verify title, approvals and documents independently.' || E'\n\n' ||
    '#MrSaProperties #VelloreRealEstate #PropertyForSale';

  select max(greatest(p.created_at, coalesce(p.published_at, p.created_at)))
    into v_fb_last_at
  from public.facebook_posts p
  where p.listing_id = new.id
    and p.auto_generated is true;

  select max(greatest(p.created_at, coalesce(p.published_at, p.created_at)))
    into v_ig_last_at
  from public.instagram_posts p
  where p.listing_id = new.id
    and p.auto_generated is true;

  v_fb_due_at := greatest(v_next_daily_at, coalesce(v_fb_last_at + interval '7 days', v_next_daily_at));
  v_ig_due_at := greatest(v_next_daily_at, coalesce(v_ig_last_at + interval '7 days', v_next_daily_at));

  insert into public.facebook_posts
    (listing_id, caption, image_url, status, created_by, auto_generated,
     attempt_count, next_attempt_at, approved_by, approved_at)
  select new.id, left(v_caption, 5000), v_image_url, 'draft', new.user_id,
         true, 0, v_fb_due_at, null, null
  where not exists (
    select 1
    from public.facebook_posts p
    where p.listing_id = new.id
      and p.auto_generated is true
      and p.status in ('draft', 'approved', 'publishing', 'review_required')
  );

  insert into public.instagram_posts
    (listing_id, caption, image_url, status, created_by, auto_generated,
     attempt_count, next_attempt_at, approved_by, approved_at)
  select new.id, left(v_caption, 2200), v_image_url, 'draft', new.user_id,
         true, 0, v_ig_due_at, null, null
  where not exists (
    select 1
    from public.instagram_posts p
    where p.listing_id = new.id
      and p.auto_generated is true
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

comment on function public.enqueue_social_posts_after_listing_approval() is
  'Queues automatic Facebook and Instagram posts after website admin approval. Posts enter the next 10:00 IST cycle (or after the per-platform 7-day cooldown) and require no separate social approval.';
