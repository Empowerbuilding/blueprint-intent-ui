-- CAPABILITIES — what the Revit bridge on each machine can do, and what it cannot.
-- Blueprint reports this through a machine route each time it connects to a bridge
-- (the bridge's own command list is the only source of truth). The app never talks to a bridge.
--   intent_bridge_reports  one row per machine per bridge build: build, Revit version, command list
--   intent_bridge_proven   commands Blueprint has run live and checked the result of
--   intent_gaps            things that were needed and the bridge could not do (open / closed)
-- Reports and proven marks are written by the machine route only. A gap can be added by anyone
-- signed in; only an approver (intent_approvers) closes or reopens one. Nothing is deleted.

create table if not exists public.intent_bridge_reports (
  id uuid primary key default gen_random_uuid(),
  machine text not null check (machine ~ '^[a-z0-9][a-z0-9_-]{0,30}$'),
  bridge_build text not null,
  revit_version text,
  commands jsonb not null default '[]'::jsonb,       -- [{ "name": "revit.x", "description": "..." }]
  reported_by text not null default 'blueprint',
  first_reported_at timestamptz not null default now(),  -- when this build was first seen on this machine
  reported_at timestamptz not null default now()         -- when it was last confirmed
);
create index if not exists intent_bridge_reports_machine_idx on public.intent_bridge_reports (machine, reported_at desc);

create table if not exists public.intent_bridge_proven (
  command text primary key,
  machine text,
  bridge_build text,
  note text,
  proven_at timestamptz not null default now()
);

create table if not exists public.intent_gaps (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open' check (status in ('open', 'closed')),
  title text not null,
  detail text not null default '',
  workaround text,
  project_name text,
  source_ref text,
  proposed_by text not null,
  created_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null,
  closed_by_email text,
  closed_at timestamptz,
  close_note text,
  constraint intent_gaps_closed check ((status = 'open') = (closed_at is null))
);
create index if not exists intent_gaps_status_idx on public.intent_gaps (status, created_at desc);

alter table public.intent_bridge_reports enable row level security;
alter table public.intent_bridge_proven enable row level security;
alter table public.intent_gaps enable row level security;

drop policy if exists "intent bridge reports: signed-in read" on public.intent_bridge_reports;
create policy "intent bridge reports: signed-in read" on public.intent_bridge_reports for select to authenticated using (true);
drop policy if exists "intent bridge proven: signed-in read" on public.intent_bridge_proven;
create policy "intent bridge proven: signed-in read" on public.intent_bridge_proven for select to authenticated using (true);

drop policy if exists "intent gaps: signed-in read" on public.intent_gaps;
drop policy if exists "intent gaps: signed-in add" on public.intent_gaps;
drop policy if exists "intent gaps: approvers close" on public.intent_gaps;
create policy "intent gaps: signed-in read" on public.intent_gaps for select to authenticated using (true);
create policy "intent gaps: signed-in add" on public.intent_gaps for insert to authenticated
  with check (status = 'open' and closed_at is null and closed_by is null);
create policy "intent gaps: approvers close" on public.intent_gaps for update to authenticated
  using (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()));
