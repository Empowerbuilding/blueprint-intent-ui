-- KINDS OF WORK: rulings on flags 36, 39 and 40 (Tony 2026-11-11 20:45Z).
--   locked = the command names are on the live bridge and their parameters were read from source.
--   proven = it ran on a real project and was measured by a read-back, with or without a build-phase check.
-- 36: mep.plumbing meets the locked bar as written (create_pipe, place_family_instance). It locks. It has never run.
-- 40: structure.stairs adopts the Patel recipe for changing a stair run and locks as recipe-backed.
--     Setting a stair path is still covered by nothing.
-- 39: site.fence and structure.resize stay locked, recipe-backed, and count as PROVEN on their receipts.
--     The note about the resize run that broke stone cuts at doors stays on the kind.
-- Nothing is removed. Receipts are not rewritten.

update public.intent_kinds
set status = 'locked', locked_build = 'f98f724', locked_at = now(), status_note = $v$Locked on names and parameters (create_pipe, place_family_instance). Never run: no recipe and no receipt yet.$v$
where kind = 'mep.plumbing' and status = 'draft';

update public.intent_kinds
set status = 'locked', backing = 'recipe', locked_build = 'f98f724', locked_at = now(),
    bridge_commands = '["revit.create_stairs","revit.batch_execute","revit.reflect_set","revit.invoke_method"]'::jsonb,
    status_note = $v$Changing a stair run is done by a recipe that ran on Patel (riser count read back). Setting a stair path: nothing covers it yet.$v$,
    recipe = jsonb_set(jsonb_set(jsonb_set(recipe, '{summary}', to_jsonb($v$Change an existing stair inside one stair edit: remove the landings, set each run's start and end height, move the runs, rebuild the landings, commit. Setting a stair's path is not covered.$v$::text)), '{proven}', 'true'::jsonb), '{proven_note}', to_jsonb($v$Proven by its own measured read-back on a real project (ruling 2026-11-11). It has not passed a build-phase check yet.$v$::text))
where kind = 'structure.stairs' and status = 'draft' and recipe is not null;

update public.intent_kinds
set recipe = jsonb_set(jsonb_set(recipe, '{proven}', 'true'::jsonb), '{proven_note}', to_jsonb($v$Proven by its own measured read-back on a real project (ruling 2026-11-11). It has not passed a build-phase check yet.$v$::text))
where kind in ('site.fence', 'structure.resize') and recipe is not null and (recipe ->> 'proven') = 'false';

update public.intent_kinds set status_note = $v$Two recipes have run, each measured by its own script. Flat pad: a fence wall type. Open ground: a railing hosted on the terrain.$v$ where kind = 'site.fence';
