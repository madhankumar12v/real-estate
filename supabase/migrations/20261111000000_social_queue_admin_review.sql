-- Require a fresh administrator approval for every automatically generated social post.
-- Preserve published posts and any item that already has a Meta post/media ID.
UPDATE public.facebook_posts
SET status = 'draft',
    approved_at = NULL,
    approved_by = NULL,
    next_attempt_at = NULL,
    processing_started_at = NULL
WHERE auto_generated = true
  AND status = 'approved'
  AND published_at IS NULL
  AND fb_post_id IS NULL
  AND fb_media_id IS NULL;

UPDATE public.instagram_posts
SET status = 'draft',
    approved_at = NULL,
    approved_by = NULL,
    next_attempt_at = NULL,
    processing_started_at = NULL
WHERE auto_generated = true
  AND status = 'approved'
  AND published_at IS NULL
  AND ig_media_id IS NULL;

CREATE OR REPLACE FUNCTION public.require_social_post_admin_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.auto_generated IS TRUE THEN
    NEW.status := 'draft';
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.next_attempt_at := NULL;
    NEW.processing_started_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS facebook_posts_require_admin_approval ON public.facebook_posts;
CREATE TRIGGER facebook_posts_require_admin_approval
BEFORE INSERT ON public.facebook_posts
FOR EACH ROW
EXECUTE FUNCTION public.require_social_post_admin_approval();

DROP TRIGGER IF EXISTS instagram_posts_require_admin_approval ON public.instagram_posts;
CREATE TRIGGER instagram_posts_require_admin_approval
BEFORE INSERT ON public.instagram_posts
FOR EACH ROW
EXECUTE FUNCTION public.require_social_post_admin_approval();

-- Allow the explicit admin-rejected state while preserving the existing queue states.
ALTER TABLE public.facebook_posts
  DROP CONSTRAINT IF EXISTS facebook_posts_status_check;
ALTER TABLE public.facebook_posts
  ADD CONSTRAINT facebook_posts_status_check
  CHECK (status IN ('draft', 'approved', 'publishing', 'published', 'failed', 'rejected'));

ALTER TABLE public.instagram_posts
  DROP CONSTRAINT IF EXISTS instagram_posts_status_check;
ALTER TABLE public.instagram_posts
  ADD CONSTRAINT instagram_posts_status_check
  CHECK (status IN ('draft', 'approved', 'publishing', 'published', 'failed', 'rejected'));
