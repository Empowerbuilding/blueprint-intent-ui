-- LESSONS LEDGER — what Blueprint has learned and should keep doing.
-- Blueprint (or anyone signed in) PROPOSES a lesson. Only an approver can ACCEPT, DISMISS or
-- RETIRE one (Mitch, blueprint-mitch 2026-11-11 04:37Z: "me and michael both").
-- Blueprint works from accepted lessons only (GET /api/lessons).
-- The split is enforced here in the database, not only in the app: a signed-in account that is
-- not in intent_approvers cannot change a lesson, whatever it sends.

create table if not exists public.intent_approvers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  added_at timestamptz not null default now()
);

create table if not exists public.intent_lessons (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'dismissed', 'retired')),
  kind text not null default 'process' check (kind in ('modeling', 'construction_docs', 'components', 'process', 'app')),
  title text not null,                       -- the lesson in one line
  what_happened text not null default '',    -- the evidence: what went wrong or what was corrected
  proposed_rule text not null,               -- what Blueprint would do from now on, as proposed
  accepted_rule text,                        -- the wording as accepted (an approver may reword it)
  project_id uuid references public.intent_projects(id) on delete set null,
  project_name text,                         -- kept so the lesson still reads after a project is deleted
  source text not null default 'blueprint' check (source in ('blueprint', 'person')),
  source_ref text,
  proposed_by text not null,                 -- 'blueprint' or the email of the person who added it
  decided_by uuid references auth.users(id) on delete set null,
  decided_by_email text,
  decided_at timestamptz,                    -- the latest accept / dismiss / retire
  accepted_at timestamptz,                   -- kept after a retire
  decision_note text,
  created_at timestamptz not null default now(),
  constraint intent_lessons_decided check ((status = 'proposed') = (decided_at is null)),
  constraint intent_lessons_accepted_rule check (status <> 'accepted' or accepted_rule is not null)
);
create index if not exists intent_lessons_status_idx on public.intent_lessons (status, created_at desc);

alter table public.intent_approvers enable row level security;
alter table public.intent_lessons enable row level security;

-- approvers: anyone signed in can see who they are; nobody can change the list from the app
drop policy if exists "intent approvers: signed-in read" on public.intent_approvers;
create policy "intent approvers: signed-in read" on public.intent_approvers
  for select to authenticated using (true);

-- lessons: anyone signed in can read and propose; only approvers can change one; nobody deletes
drop policy if exists "intent lessons: signed-in read" on public.intent_lessons;
drop policy if exists "intent lessons: signed-in propose" on public.intent_lessons;
drop policy if exists "intent lessons: approvers decide" on public.intent_lessons;
create policy "intent lessons: signed-in read" on public.intent_lessons
  for select to authenticated using (true);
create policy "intent lessons: signed-in propose" on public.intent_lessons
  for insert to authenticated
  with check (status = 'proposed' and decided_at is null and decided_by is null and accepted_rule is null);
create policy "intent lessons: approvers decide" on public.intent_lessons
  for update to authenticated
  using (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.intent_approvers a where a.user_id = auth.uid()));

-- the two approvers. Fails the deploy (nothing above is kept) unless exactly one account matches each
-- name, so the wrong person can never be made an approver by a loose match.
do $$
declare n_mitch int; n_michael int; r record;
begin
  select count(*) into n_mitch from auth.users where split_part(lower(email), '@', 1) like 'mitch%';
  select count(*) into n_michael from auth.users where split_part(lower(email), '@', 1) like 'michael%' or split_part(lower(email), '@', 1) like 'mike%';
  if n_mitch <> 1 or n_michael <> 1 then
    raise exception 'approver seed: expected exactly one account each for Mitch and Michael, found % and %', n_mitch, n_michael;
  end if;
  insert into public.intent_approvers (user_id, email, name)
    select id, email, 'Mitch' from auth.users where split_part(lower(email), '@', 1) like 'mitch%'
    on conflict (user_id) do nothing;
  insert into public.intent_approvers (user_id, email, name)
    select id, email, 'Michael' from auth.users where split_part(lower(email), '@', 1) like 'michael%' or split_part(lower(email), '@', 1) like 'mike%'
    on conflict (user_id) do nothing;
  for r in select name, split_part(email, '@', 1) as login from public.intent_approvers order by name loop
    raise notice 'approver: % (login "%")', r.name, r.login;
  end loop;
end $$;
