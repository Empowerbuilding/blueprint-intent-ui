-- RUN PHASES (Mitch, 2026-11-21 15:27Z: "we need to make sure the ui is matching the types of runs and
-- displaying right info as needed"). While a work order executes, the runner reports each phase as it
-- starts and finishes; the project page shows the list under the progress tracker, so a 32-phase
-- two-day run is no longer one opaque "Build" dot (the Whaley ENG project said "locked" from emit to
-- forever — nothing ever reported the run back).
--   state: todo | doing | done | failed
-- Written by POST /api/run-status (x-emit-secret, same guard as /api/emit); read by the project page.
create table if not exists public.intent_run_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.intent_projects(id) on delete cascade,
  phase_key text not null,
  label text not null,
  state text not null default 'todo' check (state in ('todo', 'doing', 'done', 'failed')),
  note text,
  sort int not null default 0,
  updated_at timestamptz not null default now(),
  unique (project_id, phase_key)
);
alter table public.intent_run_phases enable row level security;
drop policy if exists "intent_run_phases authenticated read" on public.intent_run_phases;
create policy "intent_run_phases authenticated read" on public.intent_run_phases
  for select to authenticated using (true);
create index if not exists intent_run_phases_project on public.intent_run_phases (project_id, sort);
