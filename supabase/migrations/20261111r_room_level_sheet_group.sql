-- Contract v2: the level a room is on and the interior sheet it is drawn on (Tony 2026-11-11 20:56Z, decision 4; SPEC A71).
-- Additive. Nothing that exists changes meaning: both columns are empty until a scan or a person fills them.
--   level        the model's level name for the room ("Level 1.0"). The room board push fills it from the scan;
--                a person can set it for a room the model does not have yet.
--   sheet_group  the room group whose interior sheet this room is drawn on (the Schwan layout, SPEC A42: one sheet per
--                room group). A person sets it; the app proposes the room's role. NULL = nobody has said;
--                '' = a person said this room gets no interior sheet.
alter table public.intent_rooms add column if not exists level text;
alter table public.intent_rooms add column if not exists sheet_group text;

-- rooms already pushed from a scan carry their level inside model_state: copy it once
update public.intent_rooms
   set level = nullif(btrim(model_state->>'level'), '')
 where level is null
   and model_state ? 'level';
