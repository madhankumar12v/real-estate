-- Repair the property-approval -> social-draft trigger.
-- The prior migration created enqueue_social_posts_after_listing_approval(),
-- but left the older trigger attached to queue_listing_for_social_automation().
-- Reattach the trigger so new approvals create unapproved drafts.
--
-- Also recover legacy auto-generated rows that were marked approved without
-- an administrator identity. They must be drafts so the normal Approve action
-- can process them safely.

update public.facebook_posts
set status = 'draft',
    approved_at = null,
    approved_by = null,
    next_attempt_at = null,
    processing_started_at = null
where auto_generated is true
  and status = 'approved'
  and (approved_at is null or approved_by is null)
  and published_at is null
  and fb_post_id is null
  and fb_media_id is null;

update public.instagram_posts
set status = 'draft',
    approved_at = null,
    approved_by = null,
    next_attempt_at = null,
    processing_started_at = null
where auto_generated is true
  and status = 'approved'
  and (approved_at is null or approved_by is null)
  and published_at is null
  and ig_media_id is null;

drop trigger if exists listings_queue_social_posts_after_approval on public.listings;
drop trigger if exists listings_enqueue_social_posts_after_approval on public.listings;

create trigger listings_queue_social_posts_after_approval
after update of status on public.listings
for each row
when (new.status = 'approved' and old.status is distinct from new.status)
execute function public.enqueue_social_posts_after_listing_approval();

-- Backfill currently approved properties that have a public photo and are
-- eligible under the existing per-platform 7-day cooldown/deduplication rules.
-- The function creates draft rows only; it never approves or publishes them.
select public.generate_daily_social_drafts();
