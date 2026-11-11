-- Backfill-safe guard: a social post is publishable only after an explicit admin action.
-- Any legacy auto-generated approval without approver metadata returns to draft.
UPDATE public.facebook_posts
SET status='draft', approved_at=NULL, approved_by=NULL, next_attempt_at=NULL, processing_started_at=NULL
WHERE auto_generated IS TRUE
  AND status='approved'
  AND (approved_at IS NULL OR approved_by IS NULL)
  AND published_at IS NULL
  AND fb_post_id IS NULL
  AND fb_media_id IS NULL;

UPDATE public.instagram_posts
SET status='draft', approved_at=NULL, approved_by=NULL, next_attempt_at=NULL, processing_started_at=NULL
WHERE auto_generated IS TRUE
  AND status='approved'
  AND (approved_at IS NULL OR approved_by IS NULL)
  AND published_at IS NULL
  AND ig_media_id IS NULL;
