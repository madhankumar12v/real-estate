-- Property PDF uploads for MrSa Properties.
-- Run this migration in Supabase SQL Editor before deploying the frontend changes.

create table if not exists public.listing_documents (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  file_name text not null,
  file_path text not null unique,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.listing_documents enable row level security;

drop policy if exists "listing documents public read approved" on public.listing_documents;
create policy "listing documents public read approved"
on public.listing_documents for select
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (l.status = 'approved' or l.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "listing owners add documents" on public.listing_documents;
create policy "listing owners add documents"
on public.listing_documents for insert to authenticated
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (l.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "listing owners delete documents" on public.listing_documents;
create policy "listing owners delete documents"
on public.listing_documents for delete to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id
      and (l.user_id = auth.uid() or public.is_admin())
  )
);

-- Keep PDFs in a private bucket. The app issues short-lived signed URLs only
-- when the listing is approved, or when the owner/admin is viewing it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-documents', 'property-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf'];

drop policy if exists "approved listing documents can be viewed" on storage.objects;
create policy "approved listing documents can be viewed"
on storage.objects for select
using (
  bucket_id = 'property-documents'
  and exists (
    select 1 from public.listings l
    where l.id::text = (storage.foldername(name))[1]
      and (l.status = 'approved' or l.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "listing owners upload their documents" on storage.objects;
create policy "listing owners upload their documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'property-documents'
  and exists (
    select 1 from public.listings l
    where l.id::text = (storage.foldername(name))[1]
      and (l.user_id = auth.uid() or public.is_admin())
  )
);

drop policy if exists "listing owners delete their documents" on storage.objects;
create policy "listing owners delete their documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'property-documents'
  and exists (
    select 1 from public.listings l
    where l.id::text = (storage.foldername(name))[1]
      and (l.user_id = auth.uid() or public.is_admin())
  )
);
