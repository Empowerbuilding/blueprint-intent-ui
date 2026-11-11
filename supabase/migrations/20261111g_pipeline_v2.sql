-- INTENT PIPELINE v2, milestone M1 (spec: Tony / Mitch 2026-11-11, reference/intent_v2/SPEC.md in the Blueprint workspace).
-- Everything here is ADDED. Nothing existing is changed or removed, and contract v1 is built exactly as before.
--   1. kinds        the controlled list of kinds of work a decision can be (draft until checked against a live bridge)
--   2. typing       a kind on each decision and redline note; a role, a 2D yes/no and a shell-changed mark on each room
--   3. contract v2  stored beside v1 on the same emission
--   4. model checks the registry of checks run on the built model. Blueprint proposes; only an approver accepts.

-- ============ 1. KINDS ============
create table if not exists public.intent_kinds (
  kind text primary key,
  family text not null,
  label text not null,
  description text not null default '',
  executable boolean not null default true,      -- false = "no work": context that is carried, not built
  status text not null default 'draft' check (status in ('draft','locked')),
  stage_scope text,                              -- null = every stage; else the stage pack it belongs to
  active boolean not null default true,
  sort_order int not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_email text,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.intent_kinds enable row level security;
drop policy if exists "intent kinds: signed-in read" on public.intent_kinds;
drop policy if exists "intent kinds: approvers add" on public.intent_kinds;
drop policy if exists "intent kinds: approvers change" on public.intent_kinds;
create policy "intent kinds: signed-in read" on public.intent_kinds for select to authenticated using (true);
create policy "intent kinds: approvers add" on public.intent_kinds for insert to authenticated
  with check (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()));
create policy "intent kinds: approvers change" on public.intent_kinds for update to authenticated
  using (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()));

insert into public.intent_kinds (kind, family, label, description, executable, stage_scope, sort_order) values
  ('opening.place', 'opening', $v$Opening: place$v$, $v$A new window, door, slider, overhead door or skylight.$v$, true, null, 10),
  ('opening.replace', 'opening', $v$Opening: replace$v$, $v$Swap an existing window or door for another type.$v$, true, null, 20),
  ('opening.modify', 'opening', $v$Opening: modify$v$, $v$Move, resize or re-swing an existing window or door.$v$, true, null, 30),
  ('room.config', 'room', $v$Room: name / number / department$v$, $v$Room name, number or department.$v$, true, null, 40),
  ('room.palette', 'room', $v$Room: colour fill$v$, $v$Room colour scheme.$v$, true, null, 50),
  ('casework.place', 'casework', $v$Casework: place$v$, $v$A new cabinet run, island, shelf, bench, locker or built-in.$v$, true, null, 60),
  ('casework.modify', 'casework', $v$Casework: modify$v$, $v$Change or move existing casework.$v$, true, null, 70),
  ('casework.rehost', 'casework', $v$Casework: re-host$v$, $v$Assign existing casework to a new host.$v$, true, null, 80),
  ('casework.counter', 'casework', $v$Counter$v$, $v$A countertop slab (and its cutouts).$v$, true, null, 90),
  ('appliance.place', 'appliance', $v$Appliance$v$, $v$Fridge, range, microwave, dishwasher, washer, dryer.$v$, true, null, 100),
  ('plumbing.place', 'plumbing', $v$Plumbing fixture$v$, $v$Vanity, toilet, tub, shower (tile walls, glass, door).$v$, true, null, 110),
  ('plumbing.sink', 'plumbing', $v$Sink$v$, $v$A sink and its counter cutout.$v$, true, null, 120),
  ('plumbing.niche', 'plumbing', $v$Niche$v$, $v$A niche cut into a wall.$v$, true, null, 130),
  ('surface.floor', 'surface', $v$Floor$v$, $v$Finish floor, raised or lowered floor.$v$, true, null, 140),
  ('surface.ceiling', 'surface', $v$Ceiling$v$, $v$Ceiling height, vault, flat ceiling.$v$, true, null, 150),
  ('surface.wall', 'surface', $v$Wall$v$, $v$A wall added, removed or moved.$v$, true, null, 160),
  ('surface.beam', 'surface', $v$Beam$v$, $v$A beam.$v$, true, null, 170),
  ('surface.soffit', 'surface', $v$Soffit$v$, $v$A soffit or dropped section.$v$, true, null, 180),
  ('finish.material', 'finish', $v$Finish / material$v$, $v$Material, colour, stain, paint, tile, hardware.$v$, true, null, 190),
  ('roof.modify', 'roof', $v$Roof$v$, $v$Roof layers, fascia, overhang, chimney.$v$, true, null, 200),
  ('structure.stairs', 'structure', $v$Stairs$v$, $v$A stair added, moved or changed.$v$, true, null, 210),
  ('structure.modify', 'structure', $v$Structure: change$v$, $v$Remove or change a column or other structure.$v$, true, null, 220),
  ('structure.resize', 'structure', $v$Whole-house resize$v$, $v$The house gets longer, shorter, wider or narrower.$v$, true, null, 230),
  ('structure.foundation', 'structure', $v$Foundation$v$, $v$Foundation and columns sheet work.$v$, true, 'd2_to_d3', 240),
  ('site.modify', 'site', $v$Site$v$, $v$Driveway, pad, turnaround, topography.$v$, true, null, 250),
  ('site.fence', 'site', $v$Fence$v$, $v$Fencing.$v$, true, null, 260),
  ('site.pool', 'site', $v$Pool$v$, $v$Pool, spa, pool deck.$v$, true, null, 270),
  ('sheet.create', 'sheet', $v$Sheet: create$v$, $v$A sheet, sheet set, schedule or title block.$v$, true, null, 280),
  ('sheet.view', 'sheet', $v$Sheet: view$v$, $v$A plan, elevation, section, 3D or zoom-in view on a sheet.$v$, true, null, 290),
  ('sheet.annotate', 'sheet', $v$Note on a sheet$v$, $v$A note, tag, dimension, title-block or general-note text.$v$, true, null, 300),
  ('mep.electrical', 'mep', $v$Electrical$v$, $v$Lights, fans, outlets, switches, panel, low voltage.$v$, true, 'd2_to_d3', 310),
  ('mep.plumbing', 'mep', $v$Plumbing system$v$, $v$Drains, hose bibs, gas, water heaters, filtration.$v$, true, 'd2_to_d3', 320),
  ('qa.run', 'qa', $v$QA$v$, $v$Model and sheet checks.$v$, true, null, 330),
  ('export.pdf', 'export', $v$PDF$v$, $v$PDF of the set.$v$, true, null, 340),
  ('export.render', 'export', $v$Render / picture$v$, $v$Rendered views and concept pictures.$v$, true, null, 350),
  ('context', 'context', $v$No work: context only$v$, $v$Nothing is built from this line. It is carried in the contract as context.$v$, false, null, 9000)
on conflict (kind) do nothing;

-- ============ 2. TYPING ============
alter table public.intent_decisions add column if not exists kind text references public.intent_kinds(kind);
alter table public.intent_decisions add column if not exists params jsonb not null default '{}'::jsonb;
alter table public.intent_decisions add column if not exists kind_set_by text;
alter table public.intent_decisions add column if not exists kind_set_at timestamptz;
alter table public.intent_redline_notes add column if not exists kind text references public.intent_kinds(kind);
alter table public.intent_rooms add column if not exists role text;
alter table public.intent_rooms add column if not exists needs_2d boolean;                 -- null = nobody has said yet
alter table public.intent_rooms add column if not exists shell_changed boolean not null default false;
alter table public.intent_rooms add column if not exists typed_by text;
alter table public.intent_rooms add column if not exists typed_at timestamptz;
alter table public.intent_projects add column if not exists doc_title text;                -- the Revit file title Blueprint must be in

-- ============ 3. CONTRACT v2 ============
alter table public.intent_emissions add column if not exists intent_v2_json jsonb;         -- null = v2 was not emitted
alter table public.intent_emissions add column if not exists v2_errors jsonb;              -- why not, when it was not
alter table public.intent_emissions add column if not exists v2_work_items int;

-- ============ 4. MODEL CHECKS ============
create table if not exists public.intent_model_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  description text not null default '',
  status text not null default 'proposed' check (status in ('proposed','accepted','retired')),
  kinds text[] not null default '{}',            -- the kinds of work this check is attached to
  params jsonb not null default '{}'::jsonb,
  checker text,                                  -- the script or tool that runs it; null = none written yet
  checker_status text not null default 'none' check (checker_status in ('none','script','tool','app')),
  source text,                                   -- where the check comes from
  version int not null default 1,
  proposed_by text not null default 'blueprint',
  decided_by uuid references auth.users(id) on delete set null,
  decided_by_email text,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists intent_model_rules_status_idx on public.intent_model_rules (status, rule_key);
alter table public.intent_model_rules enable row level security;
drop policy if exists "intent model rules: signed-in read" on public.intent_model_rules;
drop policy if exists "intent model rules: signed-in propose" on public.intent_model_rules;
drop policy if exists "intent model rules: approvers decide" on public.intent_model_rules;
create policy "intent model rules: signed-in read" on public.intent_model_rules for select to authenticated using (true);
create policy "intent model rules: signed-in propose" on public.intent_model_rules for insert to authenticated
  with check (status = 'proposed' and decided_at is null and decided_by is null);
create policy "intent model rules: approvers decide" on public.intent_model_rules for update to authenticated
  using (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()));

-- the backlog from the D1 to D2 stage-pack draft, all as PROPOSED: nothing is in force until an approver accepts it
insert into public.intent_model_rules (rule_key, description, source, kinds) values
  ('intake.doc_title_matches', $v$The open Revit file is the one the work order names.$v$, $v$runbook section 3 gate 12$v$, '{}'::text[]),
  ('intake.rooms_match_contract', $v$Every room number in the contract exists in the model.$v$, $v$compiler stage P1$v$, '{}'::text[]),
  ('intake.fingerprint_current', $v$The contract and the approved drawings have not changed since the work order was compiled.$v$, $v$work_order_compile --check$v$, '{}'::text[]),
  ('doc.is_d2_save_as', $v$The open file is the Draft 2 save-as, not the Draft 1 file.$v$, $v$runbook stage 2$v$, '{}'::text[]),
  ('room.no_zero_area', $v$No room has zero area.$v$, $v$runbook stage 2b$v$, '{}'::text[]),
  ('room.no_duplicate_numbers', $v$No two rooms share a number.$v$, $v$runbook stage 2b$v$, '{}'::text[]),
  ('room.numbers_match_board', $v$Room numbers in the model equal the room board.$v$, $v$runbook stage 4$v$, '{}'::text[]),
  ('room.palette_rgb', $v$Room colour fills use the standard palette.$v$, $v$runbook stage 4$v$, array['room.palette']::text[]),
  ('sheet.no_later_stage_sheets', $v$No foundation, electrical, plumbing or structural sheet in a Draft 2 set.$v$, $v$runbook stage 2; D2 sets$v$, '{}'::text[]),
  ('shell.rooms_still_enclosed', $v$After a wall, stair or size change every room is still enclosed.$v$, $v$pack phase P2S$v$, array['structure.resize','structure.modify','structure.stairs','surface.wall']::text[]),
  ('shell.outline_matches_model', $v$A shell-changed room's approved drawing matches the model after the change, within tolerance.$v$, $v$spec amendment A12$v$, array['structure.resize','structure.modify','structure.stairs','surface.wall']::text[]),
  ('model.warnings_not_up', $v$The model's warning count has not risen.$v$, $v$runbook stage 8$v$, '{}'::text[]),
  ('opening.bbox_verified', $v$Every placed or swapped door and window exists where it was placed.$v$, $v$runbook stage 3$v$, array['opening.place','opening.replace','opening.modify']::text[]),
  ('opening.marks_clean', $v$Every opening carries a type mark and the marks check is clean.$v$, $v$runbook stage 3$v$, array['opening.place','opening.replace','opening.modify']::text[]),
  ('casework.no_overlap', $v$No two casework solids overlap.$v$, $v$spec 4.3$v$, array['casework.place','casework.modify','casework.counter','appliance.place']::text[]),
  ('casework.position_within_1in_of_2d', $v$Built casework sits within 1 inch of the approved 2D drawing.$v$, $v$spec 4.3$v$, array['casework.place','casework.counter','appliance.place','plumbing.place','plumbing.sink']::text[]),
  ('casework.no_opening_intersection', $v$No casework crosses a door, window or appliance.$v$, $v$runbook stage 5$v$, array['casework.place','casework.modify','casework.counter','appliance.place']::text[]),
  ('casework.faces_have_material', $v$Every face of every built family has a material.$v$, $v$runbook stage 5$v$, array['casework.place','casework.counter']::text[]),
  ('sink.cutout_matches_bowl', $v$Each counter cutout equals its sink bowl, the sink is centred, the rim is under the slab.$v$, $v$runbook stage 6$v$, array['plumbing.sink','casework.counter']::text[]),
  ('counter.no_builtin_splash', $v$No countertop has a built-in backsplash.$v$, $v$runbook stage 6$v$, array['casework.counter']::text[]),
  ('plumbing.toilet_clearance_15_21', $v$Toilets have 15 inches to each side and 21 inches in front.$v$, $v$spec 4.3$v$, array['plumbing.place']::text[]),
  ('bath.tile_cut_at_openings', $v$Shower tile walls are cut around every opening in the host wall.$v$, $v$runbook stage 7$v$, array['plumbing.place']::text[]),
  ('bath.niche_void_cut', $v$Niches are real cuts in the wall.$v$, $v$runbook stage 7$v$, array['plumbing.niche']::text[]),
  ('bath.one_room_per_bath', $v$Each bath is one room.$v$, $v$runbook section 3 gate 10$v$, '{}'::text[]),
  ('floor.threshold_both_sides', $v$A finish floor is present on both sides of every door.$v$, $v$runbook stage 8 threshold gate$v$, array['surface.floor']::text[]),
  ('floor.no_uncovered_slab', $v$No slab is left without a finish floor.$v$, $v$runbook stage 8$v$, array['surface.floor']::text[]),
  ('ceiling.edge_z_measured', $v$Ceiling heights are measured and match the notes.$v$, $v$runbook stage 8$v$, array['surface.ceiling']::text[]),
  ('material.one_per_role', $v$One material per role across the house.$v$, $v$spec 4.3$v$, array['finish.material']::text[]),
  ('material.no_project_named', $v$No material is named after the project.$v$, $v$runbook section 8$v$, array['finish.material']::text[]),
  ('material.appearance_paths_resolve', $v$Every material's texture files sit in the shared library folders.$v$, $v$runbook section 8$v$, array['finish.material']::text[]),
  ('roof.z_vs_walls', $v$The roof sits correctly on the walls.$v$, $v$spec 4.3$v$, array['roof.modify']::text[]),
  ('roof.overhang_dims_clear_of_grids', $v$Overhang dimensions do not collide with the grid lines.$v$, $v$runbook stage 10$v$, array['roof.modify']::text[]),
  ('site.driveway_is_toposolid_split', $v$The driveway is a split of the site surface, not an overlay.$v$, $v$playbook, Site Plan$v$, array['site.modify']::text[]),
  ('site.conceptual_note_present', $v$The conceptual-site-plan note is on the site sheet unless a survey was given.$v$, $v$D2 sets (Schwan, Deubner)$v$, '{}'::text[]),
  ('sheet.set_matches_stage', $v$The sheet set matches the list for this draft stage.$v$, $v$runbook stage 2$v$, '{}'::text[]),
  ('sheet.bounds_edge_clean', $v$Everything on every sheet sits inside the page outline.$v$, $v$spec 4.3$v$, array['sheet.create','sheet.view','sheet.annotate']::text[]),
  ('sheet.tags_text_only', $v$Tags are text only.$v$, $v$runbook section 3 gate 11$v$, '{}'::text[]),
  ('sheet.schedules_on_dimension_plan', $v$Door and window schedules are on the dimension plan.$v$, $v$D2 sets, 3 of 3$v$, '{}'::text[]),
  ('final.qa_clean', $v$The final model and sheet checks are clean.$v$, $v$spec 4.3$v$, '{}'::text[]),
  ('final.pdf_exists', $v$The PDF of the full set exists.$v$, $v$runbook stage 12$v$, '{}'::text[])
on conflict (rule_key) do nothing;

do $$
declare n_kinds int; n_rules int; n_bad int;
begin
  select count(*) into n_kinds from public.intent_kinds;
  select count(*) into n_rules from public.intent_model_rules;
  select count(*) into n_bad from public.intent_model_rules r, unnest(r.kinds) k where not exists (select 1 from public.intent_kinds x where x.kind = k);
  raise notice 'intent_kinds rows: %, intent_model_rules rows: %', n_kinds, n_rules;
  if n_kinds < 36 then raise exception 'kinds seed incomplete: % rows', n_kinds; end if;
  if n_rules < 40 then raise exception 'model rules seed incomplete: % rows', n_rules; end if;
  if n_bad > 0 then raise exception 'model rules name % kind(s) that are not in the vocabulary', n_bad; end if;
end $$;
