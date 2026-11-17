-- PROCESS PER PROJECT (Mitch, blueprint-mitch 2026-11-17 07:35Z: "go ahead and buidl the process picker. bc we habe
-- alot more to add other than the d1 to d2 and now this structural one").
-- A process is a kind of job Blueprint runs from a stage pack (stages/<key>/ in Blueprint's workspace): which playbook
-- a project follows when its work order is set up. The list lives here so a new process is a row, not a code change.
--   status live  = an accepted stage pack exists; work orders can be compiled for it.
--   status draft = the playbook is written but not accepted; a project can be filed under it, no work order yet.
create table if not exists public.intent_processes (
  key text primary key,
  title text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('live', 'draft')),
  sort int not null default 100,
  created_at timestamptz not null default now()
);
alter table public.intent_processes enable row level security;
drop policy if exists "intent_processes authenticated read" on public.intent_processes;
create policy "intent_processes authenticated read" on public.intent_processes
  for select to authenticated using (true);

insert into public.intent_processes (key, title, description, status, sort) values
  ('d1_to_d2', 'Draft 1 to Draft 2', 'The designer''s Draft 1 model to a client-ready Draft 2: room board, decisions, 2D drawings, 3D build, sheets.', 'live', 10),
  ('eng_frame', 'Engineer set to 3D frame', 'The engineer''s 2D structural set and the designer''s model to a 3D frame model: foundation, steel, floor framing, stud walls, ceiling framing.', 'draft', 20)
on conflict (key) do nothing;

alter table public.intent_projects add column if not exists process text not null default 'd1_to_d2' references public.intent_processes(key);
comment on column public.intent_projects.process is 'Which process (intent_processes.key) this project follows; picks the stage pack its work order is compiled from';
