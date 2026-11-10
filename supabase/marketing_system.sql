-- MrSa Properties: Marketing & Growth system
-- Run after supabase/website_visitors.sql in Supabase SQL Editor.
-- Safe to re-run. Stores campaign metadata and first-touch UTM attribution on real enquiries.

alter table public.enquiries add column if not exists marketing_source text;
alter table public.enquiries add column if not exists utm_source text;
alter table public.enquiries add column if not exists utm_medium text;
alter table public.enquiries add column if not exists utm_campaign text;
alter table public.enquiries add column if not exists landing_page text;
alter table public.enquiries add column if not exists referrer_host text;

create index if not exists enquiries_utm_campaign_created_at_idx
  on public.enquiries (utm_campaign, created_at desc);
create index if not exists enquiries_marketing_source_created_at_idx
  on public.enquiries (marketing_source, created_at desc);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_name text not null check (char_length(campaign_name) between 1 and 160),
  platform text not null check (platform in ('Facebook','Instagram','YouTube','LinkedIn','WhatsApp','Google Search','Other website')),
  utm_source text not null,
  utm_medium text not null,
  utm_campaign text not null,
  landing_path text not null default '/',
  budget numeric(12,2) not null default 0 check (budget >= 0),
  spent numeric(12,2) not null default 0 check (spent >= 0),
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_campaigns_created_at_idx
  on public.marketing_campaigns (created_at desc);
create index if not exists marketing_campaigns_utm_campaign_idx
  on public.marketing_campaigns (utm_campaign);

alter table public.marketing_campaigns enable row level security;
drop policy if exists "admins manage marketing campaigns" on public.marketing_campaigns;
create policy "admins manage marketing campaigns"
  on public.marketing_campaigns for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.marketing_campaigns to authenticated;
