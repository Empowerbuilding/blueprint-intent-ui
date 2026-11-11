-- DEFAULTS — what gets built when nobody decided otherwise — become data that an approver edits in the
-- app (Rulebook -> Defaults), instead of a list fixed in the app's code (src/lib/defaults.ts).
-- Filled with exactly that list, in the same order, so nothing changes on day one.
-- Same split as lessons: anyone signed in can read; only an account in intent_approvers can add or
-- change a default; nobody deletes (a default is turned off, and every change is kept in the history).

create table if not exists public.intent_defaults (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  value text not null,
  scope text not null default 'house' check (scope in ('house','public','secondary','garage','adu','bath','master','outdoor')),
  active boolean not null default true,
  sort_order int not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_email text,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists intent_defaults_topic_key on public.intent_defaults (lower(topic));

create table if not exists public.intent_defaults_history (
  id uuid primary key default gen_random_uuid(),
  default_id uuid references public.intent_defaults(id) on delete set null,
  topic text not null,
  action text not null check (action in ('added','changed','turned_off','turned_on')),
  old_value text,
  new_value text,
  old_scope text,
  new_scope text,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_email text,
  changed_at timestamptz not null default now()
);
create index if not exists intent_defaults_history_at_idx on public.intent_defaults_history (changed_at desc);

alter table public.intent_defaults enable row level security;
alter table public.intent_defaults_history enable row level security;

drop policy if exists "intent defaults: signed-in read" on public.intent_defaults;
drop policy if exists "intent defaults: approvers add" on public.intent_defaults;
drop policy if exists "intent defaults: approvers change" on public.intent_defaults;
create policy "intent defaults: signed-in read" on public.intent_defaults for select to authenticated using (true);
create policy "intent defaults: approvers add" on public.intent_defaults for insert to authenticated
  with check (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()));
create policy "intent defaults: approvers change" on public.intent_defaults for update to authenticated
  using (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()));

drop policy if exists "intent defaults history: signed-in read" on public.intent_defaults_history;
drop policy if exists "intent defaults history: approvers add" on public.intent_defaults_history;
create policy "intent defaults history: signed-in read" on public.intent_defaults_history for select to authenticated using (true);
create policy "intent defaults history: approvers add" on public.intent_defaults_history for insert to authenticated
  with check (changed_by = auth.uid() and exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()));

-- the list as it was in the app's code on 2026-11-11 (only if the table is still empty)
insert into public.intent_defaults (topic, value, scope, sort_order)
select v.topic, v.value, v.scope, v.sort_order from (values
  ($v$ceiling$v$, $v$12 ft flat (public/master/kitchen); 10 ft secondary; great/dining vault = no flat ceiling$v$, 'house', 10),
  ($v$upper cabinets$v$, $v$to 10 ft under 12 ft ceilings$v$, 'house', 20),
  ($v$range pullouts$v$, $v$spice pullouts both sides of range$v$, 'house', 30),
  ($v$fridge$v$, $v$built in$v$, 'house', 40),
  ($v$hood$v$, $v$all-wood including neck$v$, 'house', 50),
  ($v$island microwave$v$, $v$in Built-In base$v$, 'house', 60),
  ($v$vanities$v$, $v$21" full-run$v$, 'bath', 70),
  ($v$toilet clearance$v$, $v$15" / 21"$v$, 'bath', 80),
  ($v$shower$v$, $v$3 tile walls + 1 glass + hosted door (sliding secondary, hinged out at steam/wet)$v$, 'bath', 90),
  ($v$niches$v$, $v$void-cut 38×14 secondary / 14×50 master$v$, 'bath', 100),
  ($v$closets$v$, $v$hang + double + cubbies + drawers + shoes; L corner towers$v$, 'house', 110),
  ($v$windows$v$, $v$secondary bedrooms casement; frames black; grilles off$v$, 'house', 120),
  ($v$rear opening$v$, $v$3-panel slider Option A + accordion Option B (options sheet)$v$, 'house', 130),
  ($v$roof joists$v$, $v$22" joist$v$, 'house', 140),
  ($v$cabinet material$v$, $v$Cabinets - White Oak (tint per client)$v$, 'house', 150),
  ($v$counter material$v$, $v$Counter Top = Marble 05$v$, 'house', 160),
  ($v$hardware$v$, $v$Metal - Black Matte$v$, 'house', 170),
  ($v$accents$v$, $v$Navy / Charcoal / Gray / Steel Gray / Walnut$v$, 'house', 180),
  ($v$shower tile$v$, $v$1/4" Shower Tile = Marble 05$v$, 'bath', 190),
  ($v$floors$v$, $v$plank / tile / epoxy per room$v$, 'house', 200),
  ($v$garage ceiling$v$, $v$vaulted gypsum clearing OHD$v$, 'garage', 210),
  ($v$tags$v$, $v$text-only$v$, 'house', 220),
  ($v$3D shadows$v$, $v$ON intensity 20 on 3D sheet views, OFF on Back elevation$v$, 'house', 230),
  ($v$poché$v$, $v$64/64/64 + FadeTo 55$v$, 'house', 240),
  ($v$sheet set$v$, $v$D2 list only (no MEP/structural)$v$, 'house', 250),
  ($v$titleblock$v$, $v$values deferred unless given (blank, not guessed)$v$, 'house', 260),
  ($v$cover$v$, $v$existing renders until Michael re-renders$v$, 'house', 270),
  ($v$site plan$v$, $v$conceptual (no PL/APN) unless survey given$v$, 'house', 280)
) as v(topic, value, scope, sort_order)
where not exists (select 1 from public.intent_defaults);

do $$
declare n int;
begin
  select count(*) into n from public.intent_defaults;
  raise notice 'intent_defaults rows: %', n;
  if n < 28 then raise exception 'defaults seed incomplete: % rows', n; end if;
end $$;
