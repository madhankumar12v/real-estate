-- New listing approvals must create reviewable drafts, never pre-approved posts.
-- Admin approval remains a separate action for Facebook and Instagram.
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
begin
  if new.status <> 'approved' or old.status is not distinct from new.status then
    return new;
  end if;

  select li.url into v_image_url
  from public.listing_images li
  where li.listing_id = new.id
    and li.url ~* '^https://'
  order by li.position asc, li.id asc
  limit 1;

  if v_image_url is null then
    return new;
  end if;

  v_place := concat_ws(', ', nullif(btrim(new.locality), ''),
    nullif(btrim(new.city), ''), nullif(btrim(new.district), ''));
  v_rate := case when new.price_per_sqft is null
    then 'Price on request'
    else '₹' || to_char(new.price_per_sqft, 'FM999,999,999,990.##') || ' per sq.ft.'
  end;
  v_caption := coalesce(nullif(btrim(new.title), ''), 'Property for sale')
    || E'\n' || coalesce(new.property_type, 'Property') || ' for sale in ' || coalesce(v_place, 'Tamil Nadu')
    || E'\nRate: ' || v_rate
    || E'\n\nவேலூர், காட்பாடி, குடியாத்தம், ராணிப்பேட்டை, ஆற்காடு, அணைக்கட்டு, வாலாஜா பகுதிகளில் உங்கள் அடுத்த சொத்து வாய்ப்பை MrSa Properties உடன் கண்டறியுங்கள். மேலும் விவரங்கள் மற்றும் பார்வைக்கு எங்களைத் தொடர்புகொள்ளுங்கள்.'
    || E'\n\nProperty details are shared as provided in the listing. Please verify title, approvals and documents independently.'
    || E'\n\n#MrSaProperties #VelloreRealEstate #PropertyForSale';

  insert into public.facebook_posts
    (listing_id, caption, image_url, status, created_by, auto_generated,
     attempt_count, next_attempt_at, approved_by, approved_at)
  select new.id, left(v_caption, 5000), v_image_url, 'draft', new.user_id,
    true, 0, now(), null, null
  where not exists (
    select 1 from public.facebook_posts p
    where p.listing_id = new.id and p.auto_generated is true
      and p.status in ('draft', 'approved', 'publishing', 'published', 'review_required')
  );

  insert into public.instagram_posts
    (listing_id, caption, image_url, status, created_by, auto_generated,
     attempt_count, next_attempt_at, approved_by, approved_at)
  select new.id, left(v_caption, 2200), v_image_url, 'draft', new.user_id,
    true, 0, now(), null, null
  where not exists (
    select 1 from public.instagram_posts p
    where p.listing_id = new.id and p.auto_generated is true
      and p.status in ('draft', 'approved', 'publishing', 'published', 'review_required')
  );

  return new;
end;
$$;

comment on function public.enqueue_social_posts_after_listing_approval() is
  'Creates unapproved Facebook and Instagram drafts when a listing is approved. An administrator must approve each platform post separately.';
