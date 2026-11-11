-- Public homepage statistics: aggregate-only counts from approved listings.
-- No listing-level or buyer/enquiry data is exposed by this function.
create or replace function public.get_public_homepage_stats()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'total_properties', count(*)::bigint,
    'city_towns', count(distinct nullif(btrim(city), ''))::bigint,
    'recently_added', count(*) filter (where created_at >= now() - interval '30 days')::bigint
  )
  from public.listings
  where status = 'approved';
$$;

revoke all on function public.get_public_homepage_stats() from public;
grant execute on function public.get_public_homepage_stats() to anon, authenticated;
