-- Allow the public homepage enquiry form to insert the four added fields.
-- Additive permissions only; existing table data and policies remain unchanged.
grant insert (city_town, budget_range, interest, heard_about)
  on table public.enquiries to anon, authenticated;
