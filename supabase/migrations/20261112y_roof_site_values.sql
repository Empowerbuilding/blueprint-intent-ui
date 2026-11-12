-- MODEL CHECKS: what the four checks of pack phases P10 (roof) and P10S (site) need from the app, and the tool behind them
-- (Tony ruling 2026-11-12 02:04Z on flag 80, spec amendment A95).
-- The checker (Blueprint, automation/checks_roof_site.py) carries no number and no wording of its own: each is read from the
-- check here (params).
--   roof.z_vs_walls                    tolerance_in   not in its sentence, no written source       back to proposed (part 1)
--   roof.overhang_dims_clear_of_grids  clearance_in   not in its sentence, no written source       back to proposed (part 2)
--   site.conceptual_note_present       note_text      "CONCEPTUAL SITE PLAN ONLY", the graphic standard   stays accepted (part 3)
-- THE RULE (A83, as Tony ruled it for these three): a value that a published standard states in full is that standard made
-- readable by the checker: the check stays accepted and the row names the standard. A number that nothing written states is a
-- new claim: the check goes back to proposed (A81) with the number present WITHOUT a value (null). Tony on the two roof
-- numbers: even that they exist comes from Blueprint's reading of what the check measures, and a migration cannot carry that
-- as a source. Mitch or Michael type the value on Rulebook > Model checks and accept the check again. None is guessed here.
-- How the four checks measure stands as built (Tony, same ruling, point 3).
-- Each part only where the check does not carry the value yet (safe to run twice).

-- 1. roof.z_vs_walls: "The roof sits correctly on the walls."
update public.intent_model_rules
set params = coalesce(params, '{}'::jsonb) || '{"tolerance_in": null}'::jsonb,
    status = 'proposed',
    decided_by = null,
    decided_by_email = null,
    decided_at = null,
    decision_note = $v$Back to proposed on 2026-11-12 (rule A83; Tony's ruling of 02:04Z on flag 80). This check was accepted on 2026-11-11 at 18:26Z with the sentence above and no number. Its checker measures, along every exterior wall a roof passes over, the gap between the top of the wall and the underside of the roof. It needs an allowance the sentence does not state: how large that gap may be, in either direction, and still count as the roof sitting on the wall. A larger gap means the wall stops short of the roof; a gap the other way means the wall runs up into the roof. Nobody has written that allowance down, so no value is set and none was guessed: Mitch or Michael type it here and accept the check again. Until then it does not gate the roof phase.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'roof.z_vs_walls'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'tolerance_in');

-- 2. roof.overhang_dims_clear_of_grids: "Overhang dimensions do not collide with the grid lines."
update public.intent_model_rules
set params = coalesce(params, '{}'::jsonb) || '{"clearance_in": null}'::jsonb,
    status = 'proposed',
    decided_by = null,
    decided_by_email = null,
    decided_at = null,
    decision_note = $v$Back to proposed on 2026-11-12 (rule A83; Tony's ruling of 02:04Z on flag 80). This check was accepted on 2026-11-11 at 18:26Z with the sentence above and no number. Its checker measures, on the roof plan, the distance between the middle of each dimension's text and each grid line drawn in that view. It needs a clearance the sentence does not state: how many inches on the printed sheet must lie between the two for them not to collide. Nobody has written that clearance down, so no value is set and none was guessed: Mitch or Michael type it here and accept the check again. The checker looks at every dimension of the roof plan, not only the overhang ones, because the model does not say which dimension is an overhang dimension. Until then the check does not gate the roof phase.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'roof.overhang_dims_clear_of_grids'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'clearance_in');

-- 3. site.conceptual_note_present: "The conceptual-site-plan note is on the site sheet unless a survey was given."
--    The words the checker looks for are the first words of the red disclaimer block of the graphic standard:
--    standards/D2_GRAPHIC_STANDARD.md, section "A100.2 Site Plan (Schwan p3)": Red disclaimer block: "CONCEPTUAL SITE PLAN
--    ONLY! CONFIRM EXACT PROPERTY LINES... SITE PLAN DETAILS & NOTES WILL BE ADDED ON DRAFT 3 & FINAL" (standard dated
--    2026-11-07). A complete published value: the check STAYS ACCEPTED, the version goes up, change_note names the standard.
--    params.note_text        = the words            params.note_text_source = where they come from (shown under the field)
--    Who accepted the check and when are not touched. An approver can change the words on the page.
update public.intent_model_rules
set params = jsonb_build_object(
      'note_text', 'CONCEPTUAL SITE PLAN ONLY',
      'note_text_source', $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section "A100.2 Site Plan (Schwan p3)" (standard dated 2026-11-07, taken from the Schwan Draft 2 set of October 2026). It describes the red disclaimer block on the site plan, which starts "CONCEPTUAL SITE PLAN ONLY! CONFIRM EXACT PROPERTY LINES" and ends "SITE PLAN DETAILS & NOTES WILL BE ADDED ON DRAFT 3 & FINAL". These are its first four words; the standard shortens the middle of the block, so the rest is not on the check.$v$,
      'initial', true)
      || coalesce(params, '{}'::jsonb),
    change_note = $v$Words of the note added on 2026-11-12 (Tony's ruling of 02:04Z on flag 80): "CONCEPTUAL SITE PLAN ONLY", taken from the graphic standard, standards/D2_GRAPHIC_STANDARD.md, section A100.2 Site Plan (standard dated 2026-11-07). The sentence of this check already says the conceptual-site-plan note must be on the site sheet; these are the words of that note written out so the checker reads them from here and Mitch or Michael can change them on this page. What the check proves did not change, so it stays accepted; the version went up. How the checker judges: one text note on the site sheet, or in a view placed on it, must hold these words, whatever the capitals and the spacing. When the work order says a survey was given, the note is not required.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'site.conceptual_note_present'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'note_text');

-- 4. which tool checks what (as in 20261111t part 4 and the migrations after it: a fact about the tooling, not about what a
--    check proves: no version change, no status change). The text says how far the tool has been proven.
update public.intent_model_rules
set checker = 'automation/checks_roof_site.py (passes its tests on prepared data; not yet run on a model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('roof.z_vs_walls', 'roof.overhang_dims_clear_of_grids', 'site.driveway_is_toposolid_split', 'site.conceptual_note_present')
  and checker_status = 'none';

-- 5. say what is left (read in the deploy log)
do $$
declare
  n_acc int; n_prop int; n_wait int; n_tool int; n_note text;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select count(*) into n_wait from public.intent_model_rules r, jsonb_each(coalesce(r.params, '{}'::jsonb)) e
    where r.status <> 'retired' and e.value = 'null'::jsonb;
  select count(*) into n_tool from public.intent_model_rules where checker_status = 'tool';
  select r.params ->> 'note_text' into n_note from public.intent_model_rules r where r.rule_key = 'site.conceptual_note_present';
  raise notice 'model checks after the roof and site values: % accepted, % proposed, % numbers waiting for a value, % checked by a tool, note text "%"', n_acc, n_prop, n_wait, n_tool, n_note;
end $$;
