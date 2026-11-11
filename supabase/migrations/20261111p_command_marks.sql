-- COMMAND MARKS — commands the bridge lists that do not act (Tony 2026-11-11, on flags 35 and 38).
--   stub      the handler returns success and changes nothing
--   disabled  the name is on the list, its dispatch line is switched off in the bridge source
-- Read from the bridge source at the named build; none of them was called to find this out.
-- Written by migration only: a mark changes when the source is read again on a newer build.
-- No work order may call a marked command.

create table if not exists public.intent_bridge_command_marks (
  command text primary key check (command ~ '^[a-z][a-z0-9_.]{1,80}$'),
  mark text not null check (mark in ('stub', 'disabled')),
  bridge_build text not null,          -- the build whose source was read
  note text,
  marked_at timestamptz not null default now()
);

alter table public.intent_bridge_command_marks enable row level security;
drop policy if exists "intent bridge command marks: signed-in read" on public.intent_bridge_command_marks;
create policy "intent bridge command marks: signed-in read" on public.intent_bridge_command_marks for select to authenticated using (true);

insert into public.intent_bridge_command_marks (command, mark, bridge_build, note) values
  ('revit.boolean_subtract',       'stub',     'f98f724', 'The handler returns success with a note and changes nothing.'),
  ('revit.boolean_union',          'stub',     'f98f724', 'The handler returns success with a note and changes nothing.'),
  ('revit.boolean_intersect',      'stub',     'f98f724', 'The handler returns success with a note and changes nothing.'),
  ('revit.create_solid_blend',     'stub',     'f98f724', 'The handler returns success with a note and changes nothing.'),
  ('revit.create_solid_revolution','stub',     'f98f724', 'The handler returns success with a note and changes nothing.'),
  ('revit.create_solid_sweep',     'stub',     'f98f724', 'The handler returns success with a note and changes nothing.'),
  ('revit.create_cable_tray',      'disabled', 'f98f724', 'Dispatch line switched off in the source ("Temp disabled - API compat issue").'),
  ('revit.create_revision_cloud',  'disabled', 'f98f724', 'Dispatch line switched off in the source ("Temp disabled - API compat issue").'),
  ('revit.create_text_type',       'disabled', 'f98f724', 'Dispatch line switched off in the source ("Temp disabled - API compat issue").'),
  ('revit.get_mep_systems',        'disabled', 'f98f724', 'Dispatch line switched off in the source ("Temp disabled - API compat issue").'),
  ('revit.get_project_location',   'disabled', 'f98f724', 'Dispatch line switched off in the source ("Temp disabled - API compat issue").'),
  ('revit.get_render_settings',    'disabled', 'f98f724', 'Dispatch line switched off in the source ("Temp disabled - API compat issue").')
on conflict (command) do nothing;
