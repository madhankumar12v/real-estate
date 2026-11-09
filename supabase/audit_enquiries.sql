-- MrSa Properties: read-only enquiries database audit
-- Run in Supabase Dashboard > SQL Editor.
-- This script does not insert, update, delete, or alter any data/schema.

-- 1) Confirm the table exists and inspect its columns, types, defaults and nullability.
select table_schema, table_name, ordinal_position, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'enquiries'
order by ordinal_position;

-- 2) Check whether the agreed fields and old/duplicate field names exist.
select expected.column_name,
  case when c.column_name is null then 'NOT PRESENT' else 'PRESENT' end as column_status
from (values ('city_town'), ('city'), ('budget_range'), ('interest'),
             ('enquiry_type'), ('heard_about'), ('referral_source')) as expected(column_name)
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = 'enquiries'
 and c.column_name = expected.column_name
order by expected.column_name;

-- 3) Inspect RLS enablement and forced-RLS status.
select n.nspname as schema_name, c.relname as table_name,
       c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'enquiries' and c.relkind = 'r';

-- 4) List policies, including command, roles and USING/WITH CHECK expressions.
select policyname, permissive, roles, cmd, qual as using_expression, with_check as check_expression
from pg_policies
where schemaname = 'public' and tablename = 'enquiries'
order by policyname;

-- 5) Inspect table-level grants.
select grantee, privilege_type, is_grantable
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'enquiries'
order by grantee, privilege_type;

-- 6) Inspect constraints and indexes without exposing customer records.
select con.conname as constraint_name, con.contype as constraint_type,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
where con.conrelid = 'public.enquiries'::regclass
order by con.conname;

select indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename = 'enquiries'
order by indexname;

-- 7) Aggregate record count and field completeness.
-- Run this section only after section 1 confirms these fields exist.
select count(*) as total_enquiries,
  count(*) filter (where buyer_name is null or btrim(buyer_name) = '') as missing_buyer_name,
  count(*) filter (where buyer_phone is null or btrim(buyer_phone) = '') as missing_buyer_phone,
  count(*) filter (where city_town is null or btrim(city_town) = '') as missing_city_town,
  count(*) filter (where budget_range is null or btrim(budget_range) = '') as missing_budget_range,
  count(*) filter (where interest is null or btrim(interest) = '') as missing_interest,
  count(*) filter (where heard_about is null or btrim(heard_about) = '') as missing_heard_about
from public.enquiries;

-- Current frontend/CRM source uses: city_town, budget_range, interest, heard_about.
-- Do not drop city, enquiry_type or referral_source until the live results
-- have been reviewed and any legacy values have been preserved.
