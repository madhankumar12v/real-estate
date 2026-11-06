-- Allow public homepage visitors to read active Channel Partners.
-- Keep partner management restricted to authenticated admins.
begin;

grant select on table public.partners to anon;

drop policy if exists "active partners public read" on public.partners;
create policy "active partners public read"
  on public.partners
  for select
  to anon
  using (is_active = true);

commit;
