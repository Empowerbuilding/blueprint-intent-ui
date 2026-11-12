-- LOCK & EMIT: one version of a project's contract exists once (flag 52; Tony ruling 2026-11-11 20:07Z, spec amendment A56:
-- "post-emit feedback in the app so repeated clicks do not produce repeated emissions").
-- The app now writes no new version when a press would write exactly what the last emission holds (src/lib/emit-same.ts,
-- src/lib/emit-core.ts), and the button is disabled while an emission is being written. This index is the last guard, for
-- two presses that land in the same instant: the second insert of the same (project, version) is refused by the database,
-- and the app answers it as a repeat instead of writing a second row.
-- Created ONLY when no project already holds one version twice, so this migration cannot fail on rows that exist.
-- Nothing is changed or removed. Safe to run twice.

do $$
declare
  n_dup int;
begin
  select count(*) into n_dup from (
    select 1 from public.intent_emissions group by project_id, version having count(*) > 1
  ) d;
  if n_dup = 0 then
    create unique index if not exists intent_emissions_project_version_once on public.intent_emissions (project_id, version);
    raise notice 'emission once: index on (project_id, version) is in place';
  else
    raise notice 'emission once: % (project, version) pairs exist twice; index NOT created, the app guard alone applies', n_dup;
  end if;
end $$;
