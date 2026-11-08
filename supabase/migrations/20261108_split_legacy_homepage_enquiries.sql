-- Backward-compatible safety net for homepage enquiries submitted by an older
-- cached frontend. If the legacy form bundles its fields into message, split
-- them into the dedicated columns before the row is stored.
-- Existing rows are never updated.

create or replace function public.mrsa_split_legacy_homepage_enquiry()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_city text;
  v_interest text;
  v_budget text;
  v_heard text;
  v_message text;
begin
  if new.message is null then
    return new;
  end if;

  if new.city_town is null or btrim(new.city_town) = '' then
    v_city := (regexp_match(new.message, '(?m)^City / Town:[[:space:]]*(.*)$'))[1];
    if v_city is not null then new.city_town := nullif(btrim(v_city), ''); end if;
  end if;

  if new.interest is null or btrim(new.interest) = '' then
    v_interest := (regexp_match(new.message, '(?m)^Interested in:[[:space:]]*(.*)$'))[1];
    if v_interest is not null then new.interest := nullif(btrim(v_interest), ''); end if;
  end if;

  if new.budget_range is null or btrim(new.budget_range) = '' then
    v_budget := (regexp_match(new.message, '(?m)^Budget range:[[:space:]]*(.*)$'))[1];
    if v_budget is not null then new.budget_range := nullif(btrim(v_budget), ''); end if;
  end if;

  if new.heard_about is null or btrim(new.heard_about) = '' then
    v_heard := (regexp_match(new.message, '(?m)^Heard about MrSa Properties:[[:space:]]*(.*)$'))[1];
    if v_heard is not null then new.heard_about := nullif(btrim(v_heard), ''); end if;
  end if;

  v_message := (regexp_match(new.message, '(?ms)^Message:[[:space:]]*(.*)$'))[1];
  if v_message is not null then
    new.message := nullif(btrim(v_message), '');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mrsa_split_legacy_homepage_enquiry on public.enquiries;

create trigger trg_mrsa_split_legacy_homepage_enquiry
before insert on public.enquiries
for each row
execute function public.mrsa_split_legacy_homepage_enquiry();
