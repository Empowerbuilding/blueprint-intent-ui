-- 2D-FIRST STAGE — outlines, math gate (rulebook), vision gate, 2d_approved state
-- Spec: plans/work-order-ui/RESUME.md §3 (Michael's orthographic process, 11/7 juanito-blueprint thread)
-- Applied 11/9/26 via Supabase Management API to Design OS (nvsczfrljlovksrdyaix)

-- ============ 1. OUTLINES ============

create table if not exists public.intent_outlines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.intent_projects(id) on delete cascade,
  room_id uuid not null references public.intent_rooms(id) on delete cascade,
  outline_type text not null check (outline_type in ('plan','elevation','section')),
  label text not null default '',
  storage_path text,
  geometry jsonb not null default '{}'::jsonb,
  status text not null default 'pushed' check (status in ('pushed','approved','rejected','superseded')),
  checks jsonb not null default '{}'::jsonb,
  feedback text,
  replaces uuid references public.intent_outlines(id),
  pushed_by text,
  pushed_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz
);
create index if not exists intent_outlines_room_idx on public.intent_outlines(room_id);
create index if not exists intent_outlines_project_idx on public.intent_outlines(project_id);

-- ============ 2. RULEBOOK (math gate) ============

create table if not exists public.intent_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  description text not null default '',
  rule_type text not null check (rule_type in (
    'min_clearance','min_dimension','max_dimension','no_overlap',
    'forbidden_kind','required_kind','elevation_bottom_height'
  )),
  params jsonb not null default '{}'::jsonb,
  applies_to jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.intent_rulebook_versions (
  id uuid primary key default gen_random_uuid(),
  version int not null unique,
  snapshot jsonb not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ============ 3. RLS ============

alter table public.intent_outlines enable row level security;
alter table public.intent_rules enable row level security;
alter table public.intent_rulebook_versions enable row level security;

do $$
declare t text;
begin
  foreach t in array array['intent_outlines','intent_rules','intent_rulebook_versions']
  loop
    execute format('drop policy if exists "intent authenticated full" on public.%I', t);
    execute format('create policy "intent authenticated full" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ============ 4. STORAGE ============

insert into storage.buckets (id, name, public) values ('intent-outlines','intent-outlines', true)
on conflict (id) do nothing;

-- ============ 5. ROOM STATE MACHINE: confirmed → 2d_approved ============

alter table public.intent_rooms drop constraint if exists intent_rooms_review_state_check;
alter table public.intent_rooms add constraint intent_rooms_review_state_check
  check (review_state in ('unreviewed','defaults_accepted','confirmed','2d_approved'));

-- ============ 6. SEED RULES (Michael's homework starts here — edit at /rules) ============
-- Geometry contract: plans are x-right/y-down from top-left, inches.
-- Elevations/sections: x-right, y-UP from floor line (y = height above finished floor), inches.

insert into public.intent_rules (rule_key, description, rule_type, params, applies_to) values
(
  'island_clearance_42',
  'Island needs 42" minimum clear to counters, appliances, and tall cabinets.',
  'min_clearance',
  '{"between": [["island"], ["counter","appliance","fridge","range","tall_cabinet"]], "min_in": 42}',
  '{"room_names": ["Kitchen","Butler Pantry"], "outline_types": ["plan"]}'
),
(
  'walkway_min_36',
  'Walkways must be at least 36" wide.',
  'min_dimension',
  '{"kind": "walkway", "min_in": 36, "axis": "min"}',
  '{"room_names": "*", "outline_types": ["plan"]}'
),
(
  'closet_clearance_36',
  'Closet rods/shelves need 36" minimum clear to walls, doors, beds, and windows.',
  'min_clearance',
  '{"between": [["closet_rod","closet_shelf"], ["wall","door","bed","window"]], "min_in": 36}',
  '{"room_names": ["Master Closet","Closet","Walk-in Closet","Master Bath","Bath"], "outline_types": ["plan"]}'
),
(
  'uppers_aff_54',
  'Upper cabinets mount at 54" above finished floor (±1").',
  'elevation_bottom_height',
  '{"kind": "upper_cabinet", "aff": 54, "tolerance": 1}',
  '{"room_names": "*", "outline_types": ["elevation"]}'
),
(
  'soffit_max_18',
  'Soffits must not exceed 18" in height/depth.',
  'max_dimension',
  '{"kind": "soffit", "max_in": 18, "axis": "h"}',
  '{"room_names": "*", "outline_types": ["elevation","section"]}'
),
(
  'no_blind_corners',
  'Blind corner cabinets are forbidden — use hardware-accessible corners.',
  'forbidden_kind',
  '{"kind": "blind_corner", "max_count": 0}',
  '{"room_names": ["Kitchen","Butler Pantry"], "outline_types": ["plan"]}'
),
(
  'door_clearance_36',
  'Doors need 36" minimum clear to islands, beds, vanities, and appliances.',
  'min_clearance',
  '{"between": [["door"], ["island","bed","vanity","appliance","fridge","range","toilet"]], "min_in": 36}',
  '{"room_names": "*", "outline_types": ["plan"]}'
)
on conflict (rule_key) do nothing;

-- Rulebook v1 snapshot = the seeds above
insert into public.intent_rulebook_versions (version, snapshot)
select 1, coalesce(jsonb_agg(to_jsonb(r) - 'id' - 'created_at' order by r.rule_key), '[]'::jsonb)
from public.intent_rules r
where not exists (select 1 from public.intent_rulebook_versions where version = 1);
