-- Add an optional per-square-foot rate to property listings.
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS price_per_sqft numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'listings_price_per_sqft_nonnegative'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_price_per_sqft_nonnegative
      CHECK (price_per_sqft IS NULL OR price_per_sqft >= 0);
  END IF;
END $$;
