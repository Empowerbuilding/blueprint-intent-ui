-- STANDARDS — the rules + context Blueprint models and builds construction docs by,
-- surfaced in the UI so humans can see and adjust them (Mitch, 11/9: "visibly see
-- the rules and context it has on how it places components/modeling and builds out
-- the construction docs").
-- Seeded from Blueprint's standing docs (standards/*.md + D2_PLAYBOOK.md).
-- Applied 11/9/26 via Supabase Management API to Design OS (nvsczfrljlovksrdyaix)

create table if not exists public.intent_standards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null check (category in ('modeling','construction_docs','process','components')),
  title text not null,
  description text not null default '',
  content text not null default '',
  format text not null default 'markdown',
  source_path text,
  version int not null default 1,
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.intent_standards_versions (
  id uuid primary key default gen_random_uuid(),
  standard_id uuid not null references public.intent_standards(id) on delete cascade,
  version int not null,
  content text not null,
  note text,
  edited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists intent_standards_versions_idx on public.intent_standards_versions(standard_id, version desc);

alter table public.intent_standards enable row level security;
alter table public.intent_standards_versions enable row level security;

drop policy if exists "standards_auth_read" on public.intent_standards;
create policy "standards_auth_read" on public.intent_standards
  for select to authenticated using (true);
drop policy if exists "standards_auth_write" on public.intent_standards;
create policy "standards_auth_write" on public.intent_standards
  for all to authenticated using (true) with check (true);

drop policy if exists "standards_versions_auth_read" on public.intent_standards_versions;
create policy "standards_versions_auth_read" on public.intent_standards_versions
  for select to authenticated using (true);
drop policy if exists "standards_versions_auth_write" on public.intent_standards_versions;
create policy "standards_versions_auth_write" on public.intent_standards_versions
  for all to authenticated using (true) with check (true);
