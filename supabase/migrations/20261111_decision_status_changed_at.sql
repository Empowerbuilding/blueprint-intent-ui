-- Decision lines can now be removed (and put back) one at a time in the app.
-- A removal is not a new row, so created_at cannot tell that the intent changed after
-- the contract was locked. status_changed_at records a hand removal / put-back; the app
-- compares it with the last emission to mark the contract out of date.
-- Additive and nullable: existing rows, push tools and the emit contract are unaffected.

alter table public.intent_decisions
  add column if not exists status_changed_at timestamptz;
