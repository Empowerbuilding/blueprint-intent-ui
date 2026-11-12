-- MODEL CHECKS: the sheet list and the tag families go onto their checks, and the five sheet checks of pack phase P11 name their tool
-- (flag 81; Mitch 2026-11-12 02:08Z, spec amendment A96: a small thing that can be adjusted later gets a default, not a question;
-- both defaults approved by Tony at 02:34Z, spec amendment A98).
-- The checker (Blueprint, automation/checks_sheets.py) carries no sheet number and no family name of its own: it reads
-- params.sheet_list from sheet.set_matches_stage and params.tag_families from sheet.tags_text_only.
--   params.<list>        = [ "<entry>", ... ]                       what the checker compares the model with
--   params.<list>_source = { "<entry>": "<where it comes from>" }   shown under every row on Rulebook > Model checks
-- A sheet entry is a sheet number; a * at the end takes every number that starts the same way; a ? at the end means the
-- sheet may be missing.
--
-- 1. THE SHEET LIST is Blueprint's reading of the graphic standard, standards/D2_GRAPHIC_STANDARD.md, section "Sheet index"
--    (standard dated 2026-11-07). Six entries are sheet numbers the standard writes as they stand. Six carry a * or a ?
--    the standard does not write: each of those rows starts with "Blueprint's reading, not reviewed" and says what was read.
--    Because the list holds Blueprint's judgment, THE CHECK GOES BACK TO PROPOSED (rule A81, A96): it reports and does not
--    gate a build phase until Mitch or Michael accept it. Accepting it without a change keeps the marking of every row and
--    adds who adopted it (Tony 02:12Z).
--    Only where the check carries no sheet list yet (safe to run twice; a list somebody has put there is kept).
update public.intent_model_rules
set params = jsonb_build_object(
      'sheet_list', jsonb_build_array($v$A100$v$, $v$A100.1$v$, $v$A100.2$v$, $v$A100.3?$v$, $v$A101.*$v$, $v$A102.*$v$, $v$A103$v$, $v$A105$v$, $v$A106$v$, $v$A106.1*$v$, $v$A106.3?$v$, $v$A107.*$v$),
      'sheet_list_source', jsonb_build_object(
        $v$A100$v$,
        $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A100 Cover". The sheet number is taken as written.$v$,
        $v$A100.1$v$,
        $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A100.1 Enhanced/Ideas". The sheet number is taken as written.$v$,
        $v$A100.2$v$,
        $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A100.2 Site Plan". The sheet number is taken as written.$v$,
        $v$A100.3?$v$,
        $v$Blueprint's reading, not reviewed. From the graphic standard, standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "(A100.3 Site 3D — Banks has it, Deubner D1 had it: keep)". The standard puts this sheet in brackets and says to keep it where a set has it, so it is allowed and a set without it does not fail: the ? is Blueprint's reading. Take the ? away to make the sheet required.$v$,
        $v$A101.*$v$,
        $v$Blueprint's reading, not reviewed. From the graphic standard, standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A101.1 Floor Plan". The same line says a one-storey house has no pages for a second level, so a house with more levels has more A101 sheets: the * (every number that starts with A101.) is Blueprint's reading. At least one such sheet is required.$v$,
        $v$A102.*$v$,
        $v$Blueprint's reading, not reviewed. From the graphic standard, standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A102.1 Dimension Plan". As for the floor plan, a house with more levels has more A102 sheets: the * (every number that starts with A102.) is Blueprint's reading. At least one such sheet is required.$v$,
        $v$A103$v$,
        $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A103 Roof Layout". The sheet number is taken as written.$v$,
        $v$A105$v$,
        $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A105 Elevations Sides". The sheet number is taken as written.$v$,
        $v$A106$v$,
        $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A106 Elevations Front|Back". The sheet number is taken as written.$v$,
        $v$A106.1*$v$,
        $v$Blueprint's reading, not reviewed. From the graphic standard, standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A106.1 Cut Sections". The standard names one sheet. The * lets a second cut section sheet pass (A106.1 B, as the standard writes an overflow sheet for the interior elevations); it also takes A106.10 to A106.19. The * is Blueprint's reading. At least one such sheet is required.$v$,
        $v$A106.3?$v$,
        $v$Blueprint's reading, not reviewed. From the graphic standard, standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A106.3 Section Details". The standard lists this sheet without a condition, and describes it from the Schwan set only (section "A106.3 Section Details (Schwan p13)"). Blueprint's reading is that a set without section details does not fail: the ?. Take the ? away to make the sheet required.$v$,
        $v$A107.*$v$,
        $v$Blueprint's reading, not reviewed. From the graphic standard, standards/D2_GRAPHIC_STANDARD.md, section "Sheet index" (standard dated 2026-11-07), which lists "A107.1…A107.9 Interior Elevations (one sheet per room group; overflow = "A107.5 B") · A107.10/.11 Exterior ISO · A107.12/.13 Exterior 3D". One entry stands for all of them: every number that starts with A107. passes and at least one is required. The check does not tell the interior elevations from the exterior ISO and 3D sheets, so a set without the exterior sheets passes: that is Blueprint's reading. Add A107.10 and the others as entries of their own to require them.$v$),
      'initial', true)
      || coalesce(params, '{}'::jsonb),
    status = 'proposed',
    decided_by = null,
    decided_by_email = null,
    decided_at = null,
    decision_note = $v$Back to proposed on 2026-11-12 (Mitch at 02:08Z: a small thing that can be adjusted later gets a default, not a question; Tony approved this default at 02:34Z). This check was accepted on 2026-11-11 at 18:26Z with the sentence above and no list, so its checker could not run. The list is now on it, taken from the sheet index of the graphic standard (standards/D2_GRAPHIC_STANDARD.md, 2026-11-07). Six entries are sheet numbers the standard writes as they stand. Six carry a * (every number that starts the same way) or a ? (the sheet may be missing) that the standard does not write: those rows say "Blueprint's reading, not reviewed", and nobody has reviewed them. Change, add or remove a row here, then accept the check; accepting it without a change adopts the rows as shown. Until then the checker runs and reports, and the check does not gate a build phase. How it judges: every entry without a ? needs at least one sheet in the model, and every sheet in the model must be named by an entry; placeholder sheets are left out. A sheet with any other number fails, which includes the extra sheets the standard mentions for Deubner (the Title 24 sheet, the door options page): add an entry for a sheet a house should carry. Not judged: the names of the sheets, their order, the index on the cover.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'sheet.set_matches_stage'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'sheet_list');

-- 2. THE TAG FAMILIES are the two the graphic standard names in full, section "Tags & schedules (A102.1)": a complete
--    published value, not a new decision. The check's sentence ("Tags are text only.") already says so; the two names are that
--    sentence made readable by the checker (rule A83 as ruled for flags 76, 79 and 80): THE CHECK STAYS ACCEPTED, the version
--    goes up, change_note names the standard and its date. Who accepted it and when are not touched.
--    Only where the check carries no family list yet.
update public.intent_model_rules
set params = jsonb_build_object(
      'tag_families', jsonb_build_array($v$Door Tag - Text Only$v$, $v$Window Tag - Text Only$v$),
      'tag_families_source', jsonb_build_object(
        $v$Door Tag - Text Only$v$,
        $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section "Tags & schedules (A102.1)" (standard dated 2026-11-07). It says: Door/window tags = TEXT ONLY ("Door Tag - Text Only" / "Window Tag - Text Only", 5/64", no symbol lines). This row is the first of the two families it names.$v$,
        $v$Window Tag - Text Only$v$,
        $v$Graphic standard: standards/D2_GRAPHIC_STANDARD.md, section "Tags & schedules (A102.1)" (standard dated 2026-11-07). It says: Door/window tags = TEXT ONLY ("Door Tag - Text Only" / "Window Tag - Text Only", 5/64", no symbol lines). This row is the second of the two families it names.$v$),
      'initial', true)
      || coalesce(params, '{}'::jsonb),
    change_note = $v$Tag families added on 2026-11-12 (flag 81; Tony approved at 02:34Z): "Door Tag - Text Only" and "Window Tag - Text Only", the two families the graphic standard names (standards/D2_GRAPHIC_STANDARD.md, section "Tags & schedules (A102.1)", standard dated 2026-11-07). The sentence of this check already says tags are text only; the two names are what the checker compares the model with, read from here, and Mitch or Michael can change the list on this page. What the check proves did not change, so it stays accepted; the version went up. How the checker judges: every door tag and every window tag in a view that is placed on a sheet must be of one of these families. Not judged: the geometry inside the tag family, and room tags and other tags.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'sheet.tags_text_only'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'tag_families');

-- 3. which tool checks what (as in 20261112x part 2: a fact about the tooling, not about what a check proves: no version
--    change, no status change). The text says how far the tool has been proven: it passed its tests on prepared data and has
--    not run on a model. opening.marks_clean, the sixth key of the P11 exit, is judged by run.py qa-marks and is not touched.
update public.intent_model_rules
set checker = 'automation/checks_sheets.py (passes its tests on prepared data; not yet run on a model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('sheet.set_matches_stage', 'sheet.no_later_stage_sheets', 'sheet.bounds_edge_clean', 'sheet.tags_text_only', 'sheet.schedules_on_dimension_plan')
  and checker_status = 'none';

-- 4. say what is left (read in the deploy log)
do $$
declare
  n_acc int; n_prop int; n_wait int; n_tool int; n_sheets int; n_snotes int; n_fams int; n_fnotes int;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select count(*) into n_wait from public.intent_model_rules r, jsonb_each(coalesce(r.params, '{}'::jsonb)) e
    where r.status <> 'retired' and e.value = 'null'::jsonb;
  select count(*) into n_tool from public.intent_model_rules where checker_status = 'tool';
  select coalesce(jsonb_array_length(r.params -> 'sheet_list'), 0) into n_sheets from public.intent_model_rules r where r.rule_key = 'sheet.set_matches_stage';
  select count(*) into n_snotes from public.intent_model_rules r, jsonb_object_keys(coalesce(r.params -> 'sheet_list_source', '{}'::jsonb)) k where r.rule_key = 'sheet.set_matches_stage';
  select coalesce(jsonb_array_length(r.params -> 'tag_families'), 0) into n_fams from public.intent_model_rules r where r.rule_key = 'sheet.tags_text_only';
  select count(*) into n_fnotes from public.intent_model_rules r, jsonb_object_keys(coalesce(r.params -> 'tag_families_source', '{}'::jsonb)) k where r.rule_key = 'sheet.tags_text_only';
  raise notice 'model checks after the sheet lists: % accepted, % proposed, % numbers waiting for a value, % checked by a tool, % sheet entries with % notes, % tag families with % notes', n_acc, n_prop, n_wait, n_tool, n_sheets, n_snotes, n_fams, n_fnotes;
end $$;
