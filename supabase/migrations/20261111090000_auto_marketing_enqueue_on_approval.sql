-- Queue one Facebook and one Instagram post whenever an administrator approves a listing.
-- Existing manual posts are left untouched. The auto_generated flag plus the
-- listing_id guard prevents repeated approval updates from creating duplicates.
create or replace function public.queue_listing_for_social_automation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  first_image text;
  place_text text;
  rate_text text;
  post_caption text;
begin
  if new.status <> 'approved' or old.status = 'approved' then
    return new;
  end if;

  select li.url
    into first_image
  from public.listing_images li
  where li.listing_id = new.id
  order by li.position asc, li.id asc
  limit 1;

  -- Do not create unusable posts for listings without a photo.
  if first_image is null or btrim(first_image) = '' then
    return new;
  end if;

  place_text := concat_ws(', ',
    nullif(btrim(new.locality), ''),
    nullif(btrim(new.city), ''),
    nullif(btrim(new.district), '')
  );

  rate_text := case
    when new.price_per_sqft is null then 'Price on request'
    else '₹' || to_char(new.price_per_sqft, 'FM999,999,999,990.##') || ' per sq.ft.'
  end;

  post_caption :=
    coalesce(new.title, 'Property for sale') || E'\n' ||
    coalesce(new.property_type, 'Property') || ' for sale in ' || coalesce(place_text, 'Tamil Nadu') || E'\n' ||
    'Rate: ' || rate_text || E'\n\n' ||
    'வேலூர், காட்பாடி, குடியாத்தம், ராணிப்பேட்டை, ஆற்காடு, அணைக்கட்டு, வாலாஜா பகுதிகளில் உங்கள் அடுத்த சொத்து வாய்ப்பை MrSa Properties உடன் கண்டறியுங்கள். மேலும் விவரங்கள் மற்றும் பார்வைக்கு எங்களைத் தொடர்புகொள்ளுங்கள்.' || E'\n\n' ||
    'Property details are shared as provided in the listing. Please verify title, approvals and documents independently.' || E'\n\n' ||
    '#MrSaProperties #VelloreRealEstate #PropertyForSale';

  insert into public.facebook_posts
    (listing_id, caption, image_url, status, auto_generated, attempt_count, next_attempt_at)
  select new.id, post_caption, first_image, 'approved', true, 0, now()
  where not exists (
    select 1 from public.facebook_posts p
    where p.listing_id = new.id and p.auto_generated = true
  );

  insert into public.instagram_posts
    (listing_id, caption, image_url, status, auto_generated, attempt_count, next_attempt_at)
  select new.id, post_caption, first_image, 'approved', true, 0, now()
  where not exists (
    select 1 from public.instagram_posts p
    where p.listing_id = new.id and p.auto_generated = true
  );

  return new;
end;
$$;

drop trigger if exists listings_queue_social_posts_after_approval on public.listings;
create trigger listings_queue_social_posts_after_approval
after update of status on public.listings
for each row
when (new.status = 'approved' and old.status is distinct from new.status)
execute function public.queue_listing_for_social_automation();

