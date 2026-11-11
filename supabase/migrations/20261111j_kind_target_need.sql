-- KINDS OF WORK: what a kind must be pinned to before a build phase may write (Tony ruling 2026-11-11 08:59Z, flag 27).
-- The table was inside the compiler; its home is here, with the kinds, where Mitch and Michael can change it.
--   element  = an existing element in the model (it is changed or replaced)
--   location = a drawn position on the approved 2D (something new is placed)
--   any      = either one
--   none     = nothing single to pin: the work is house-wide or room-wide
-- Values are the table approved in that ruling; a kind it did not name gets 'any', which is what the compiler did.
-- Nothing existing is removed. Contract v1 and v2 are built exactly as before.

alter table public.intent_kinds add column if not exists target_need text;
alter table public.intent_kinds drop constraint if exists intent_kinds_target_need_check;
alter table public.intent_kinds add constraint intent_kinds_target_need_check check (target_need is null or target_need in ('element','location','any','none'));
alter table public.intent_kinds add column if not exists target_need_by text;
alter table public.intent_kinds add column if not exists target_need_at timestamptz;

update public.intent_kinds set target_need = 'element' where target_need is null and kind in ('opening.replace', 'opening.modify', 'casework.modify', 'casework.rehost', 'structure.modify');
update public.intent_kinds set target_need = 'location' where target_need is null and kind in ('opening.place', 'casework.place', 'casework.counter', 'appliance.place', 'plumbing.place', 'plumbing.sink');
update public.intent_kinds set target_need = 'none' where target_need is null and kind in ('finish.material', 'room.config', 'room.palette', 'sheet.create', 'sheet.view', 'sheet.annotate', 'qa.run', 'export.pdf', 'export.render', 'roof.modify');
update public.intent_kinds set target_need = 'any' where target_need is null and executable;
