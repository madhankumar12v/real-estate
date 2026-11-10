-- MrSa Properties: read-only admin database health report
-- Run this once in Supabase SQL Editor. It creates a guarded RPC for the admin dashboard.

create or replace function public.get_admin_database_health()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'database_size_bytes', pg_database_size(current_database()),
    'connections', (
      select jsonb_build_object(
        'total', count(*),
        'active', count(*) filter (where state = 'active'),
        'idle', count(*) filter (where state = 'idle'),
        'other', count(*) filter (where state is distinct from 'active' and state is distinct from 'idle')
      )
      from pg_stat_activity
      where datname = current_database()
    ),
    'tables', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'table_name', t.table_name,
          'total_bytes', t.total_bytes,
          'data_bytes', t.data_bytes
        ) order by t.total_bytes desc
      )
      from (
        select
          c.relname as table_name,
          pg_total_relation_size(c.oid) as total_bytes,
          pg_relation_size(c.oid) as data_bytes
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'm', 'p')
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_database_health() from public;
grant execute on function public.get_admin_database_health() to authenticated;
