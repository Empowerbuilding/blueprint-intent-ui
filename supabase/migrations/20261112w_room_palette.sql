-- MODEL CHECKS: the room colour palette goes onto its check, and the three room checks of pack phase P4 name their tool
-- (Tony ruling 2026-11-12 01:12Z on flag 76, spec amendment A91).
-- The checker (Blueprint, automation/checks_rooms.py) carries no colour of its own: it reads params.palette from this check.
--
-- THE PALETTE is Mitch's own published standard, not a new decision: standards/D2_GRAPHIC_STANDARD.md, section
-- "A101.1 Floor Plan", line "Room color scheme = by Department, palette (Mitch, 2026-11-08)":
--   Bedroom  230/217/200   beds + WICs + storage
--   Kitchen  252/246/214   light yellow, NOT peach/orange: great / kitchen / dining / game / gym / office / mud
--   Shower   210/220/247   baths, WC, wet room, mech
--   Carport  240/240/240   garage
--   Outdoor  240/240/240   same grey as the garage: covered patios, front porch
-- params.palette        = { "<Department>": [red, green, blue] }      what the checker compares the model with
-- params.palette_source = { "<Department>": "<where it comes from>" } shown under every row on Rulebook > Model checks
--                         (Tony's one requirement: every row names its source, the graphic standard, document and date)
-- The check's sentence ("Room colour fills use the standard palette.") already says the palette is the standard one, so
-- writing the standard's values onto the check is the sentence made readable by the checker, not a change of meaning
-- (rule A83 as ruled for flag 76): THE CHECK STAYS ACCEPTED, the version goes up, change_note names the standard and its
-- date. Who accepted it and when are not touched. An approver can change a row on the page; nothing here is locked.
-- Only where the check carries no palette yet (safe to run twice; a palette somebody has put there is kept).
update public.intent_model_rules
set params = jsonb_build_object(
      'palette', jsonb_build_object(
        'Bedroom', jsonb_build_array(230, 217, 200),
        'Kitchen', jsonb_build_array(252, 246, 214),
        'Shower',  jsonb_build_array(210, 220, 247),
        'Carport', jsonb_build_array(240, 240, 240),
        'Outdoor', jsonb_build_array(240, 240, 240)),
      'palette_source', jsonb_build_object(
        'Bedroom', $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section A101.1 Floor Plan, "Room color scheme = by Department, palette" (Mitch, 2026-11-08). It says: Bedroom 230/217/200, for beds, walk-in closets and storage.$v$,
        'Kitchen', $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section A101.1 Floor Plan, "Room color scheme = by Department, palette" (Mitch, 2026-11-08). It says: Kitchen 252/246/214, light yellow and not peach or orange, for great room, kitchen, dining, game, gym, office and mud.$v$,
        'Shower',  $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section A101.1 Floor Plan, "Room color scheme = by Department, palette" (Mitch, 2026-11-08). It says: Shower 210/220/247, for baths, WC, wet room and mechanical.$v$,
        'Carport', $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section A101.1 Floor Plan, "Room color scheme = by Department, palette" (Mitch, 2026-11-08). It says: Carport 240/240/240, for the garage.$v$,
        'Outdoor', $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section A101.1 Floor Plan, "Room color scheme = by Department, palette" (Mitch, 2026-11-08). It says: Outdoor 240/240/240, the same grey as the garage, for covered patios and the front porch.$v$),
      'initial', true)
      || coalesce(params, '{}'::jsonb),
    change_note = $v$Palette added on 2026-11-12 (Tony's ruling of 01:12Z on flag 76): five Departments with their colours, taken from the graphic standard, standards/D2_GRAPHIC_STANDARD.md, section A101.1 Floor Plan, "Room color scheme = by Department, palette" (Mitch, 2026-11-08). The sentence of this check already says the fills use the standard palette; the colours are that palette written out so the checker reads them from here and Mitch or Michael can change a row on this page. What the check proves did not change, so it stays accepted; the version went up. How the checker judges: every Department value used by a placed room must be one of these, written the same way, and the model's colour for it must equal the three values exactly; a placed room with no Department fails.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'room.palette_rgb'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'palette');

-- 2. which tool checks what (as in 20261111t part 4 and 20261111u part 2: a fact about the tooling, not about what a check
--    proves: no version change, no status change). The text says how far the tool has been proven: it passed its tests
--    on prepared data and has not run on a model.
update public.intent_model_rules
set checker = 'automation/checks_rooms.py (passes its tests on prepared data; not yet run on a model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('room.no_zero_area', 'room.numbers_match_board', 'room.palette_rgb')
  and checker_status = 'none';

-- 3. say what is left (read in the deploy log)
do $$
declare
  n_acc int; n_prop int; n_wait int; n_tool int; n_rows int;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select count(*) into n_wait from public.intent_model_rules r
    where r.status <> 'retired' and exists (select 1 from jsonb_each(coalesce(r.params, '{}'::jsonb)) e where e.value = 'null'::jsonb);
  select count(*) into n_tool from public.intent_model_rules where checker_status = 'tool';
  select count(*) into n_rows from public.intent_model_rules r, jsonb_object_keys(coalesce(r.params -> 'palette', '{}'::jsonb)) k where r.rule_key = 'room.palette_rgb';
  raise notice 'model checks after the room palette: % accepted, % proposed, % waiting for a number, % checked by a tool, % palette rows on room.palette_rgb', n_acc, n_prop, n_wait, n_tool, n_rows;
end $$;
