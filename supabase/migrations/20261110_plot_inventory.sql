-- MrSa Properties: bulk plot inventory
-- Plot availability is independent of the parent listing's publication approval.

create table if not exists public.plot_projects (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null unique references public.listings(id) on delete cascade,
  layout_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_plots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.plot_projects(id) on delete cascade,
  plot_number text not null,
  area_sqft numeric(12,2) check (area_sqft is null or area_sqft > 0),
  price numeric(14,2) check (price is null or price >= 0),
  status text not null default 'available'
    check (status in ('available','reserved','sold','blocked')),
  layout_x numeric(5,2) check (layout_x is null or layout_x between 0 and 100),
  layout_y numeric(5,2) check (layout_y is null or layout_y between 0 and 100),
  notes text,
  reserved_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, plot_number)
);

create index if not exists plot_projects_listing_id_idx on public.plot_projects(listing_id);
create index if not exists project_plots_project_status_idx on public.project_plots(project_id, status);
create index if not exists project_plots_plot_number_idx on public.project_plots(project_id, plot_number);

alter table public.plot_projects enable row level security;
alter table public.project_plots enable row level security;

drop policy if exists "approved plot projects public read" on public.plot_projects;
create policy "approved plot projects public read" on public.plot_projects
  for select using (
    exists (select 1 from public.listings l
      where l.id = listing_id and l.status = 'approved')
  );

drop policy if exists "admins manage plot projects" on public.plot_projects;
create policy "admins manage plot projects" on public.plot_projects
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "approved project plots public read" on public.project_plots;
create policy "approved project plots public read" on public.project_plots
  for select using (
    exists (select 1 from public.plot_projects pp
      join public.listings l on l.id = pp.listing_id
      where pp.id = project_id and l.status = 'approved')
  );

drop policy if exists "admins manage project plots" on public.project_plots;
create policy "admins manage project plots" on public.project_plots
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public layout images; only administrators can upload, replace or delete them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plot-layouts','plot-layouts',true,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "public view plot layouts" on storage.objects;
create policy "public view plot layouts" on storage.objects
  for select using (bucket_id = 'plot-layouts');

drop policy if exists "admins upload plot layouts" on storage.objects;
create policy "admins upload plot layouts" on storage.objects
  for insert to authenticated with check (bucket_id = 'plot-layouts' and public.is_admin());

drop policy if exists "admins update plot layouts" on storage.objects;
create policy "admins update plot layouts" on storage.objects
  for update to authenticated using (bucket_id = 'plot-layouts' and public.is_admin())
  with check (bucket_id = 'plot-layouts' and public.is_admin());

drop policy if exists "admins delete plot layouts" on storage.objects;
create policy "admins delete plot layouts" on storage.objects
  for delete to authenticated using (bucket_id = 'plot-layouts' and public.is_admin());
