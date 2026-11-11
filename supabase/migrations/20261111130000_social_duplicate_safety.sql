-- MrSa social publishing duplicate safety
-- An uncertain Meta API result must never be blindly retried.
ALTER TABLE public.facebook_posts
  DROP CONSTRAINT IF EXISTS facebook_posts_status_check;
ALTER TABLE public.facebook_posts
  ADD CONSTRAINT facebook_posts_status_check
  CHECK (status IN ('draft', 'approved', 'publishing', 'published', 'failed', 'rejected', 'review_required'));

ALTER TABLE public.instagram_posts
  DROP CONSTRAINT IF EXISTS instagram_posts_status_check;
ALTER TABLE public.instagram_posts
  ADD CONSTRAINT instagram_posts_status_check
  CHECK (status IN ('draft', 'approved', 'publishing', 'published', 'failed', 'rejected', 'review_required'));
