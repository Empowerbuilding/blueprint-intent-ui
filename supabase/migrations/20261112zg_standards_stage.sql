-- STANDARDS BY STAGE (Tony 2026-11-12 04:07Z: yes to the d1_to_d2 stage pack as version 1, "sync per SPEC 3.3").
-- SPEC 3.3: the content of a stage pack (its procedure slices) is edited and versioned in the Standards tab
-- under a grouping per stage. A document that belongs to a stage pack names the stage; every other document
-- keeps stage null and stays under its category as before.
alter table public.intent_standards add column if not exists stage text;
comment on column public.intent_standards.stage is 'Stage pack this document is a part of (d1_to_d2 ...), null for a standing standard';
