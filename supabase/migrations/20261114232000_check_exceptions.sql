-- Accepted-exception field: a person's ruling that a failed check (math rule or vision conflict)
-- is accepted for one drawing SLOT (room + outline type + label). Slot-matched, not outline-id-matched,
-- so a ruling survives re-pushes of the same slot (the re-push gets a new outline id).
-- Seeds from Blueprint's rulings.json (source = 'rulings-file-port'); the app field is the durable form.
create table if not exists intent_check_exceptions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  room_id uuid not null,
  outline_type text not null,
  label text not null default '',
  check_key text not null,                -- 'math:<rule_key>' or 'vision'
  ruled_by text not null,                 -- who accepted it (email or id)
  ruled_at timestamptz not null,          -- ISO timestamp; legacy free-text dates port as best-effort
  quote text not null default '',         -- the words the ruling was given in
  source text not null default 'app',     -- 'app' | 'rulings-file-port'
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists intent_check_exceptions_slot
  on intent_check_exceptions (project_id, room_id, outline_type, label, check_key)
  where active;
alter table intent_check_exceptions enable row level security;
drop policy if exists "intent_check_exceptions authenticated full" on intent_check_exceptions;
create policy "intent_check_exceptions authenticated full" on intent_check_exceptions
  for all to authenticated using (true) with check (true);
