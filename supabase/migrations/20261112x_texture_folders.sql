-- MODEL CHECKS: the shared library folders go onto the texture check, and the three material checks of pack phase P9 name their tool
-- (Tony ruling 2026-11-12 01:34Z on flag 79, spec amendment A94).
-- The checker (Blueprint, automation/checks_materials.py) carries no folder of its own: it reads params.texture_folders from this check.
--
-- THE FOLDERS are the two the written standards name, not a new decision: standards/D1_TO_D2_RUNBOOK.md, section 8
-- "Finished-look gate", point (b): appearance-asset bitmap paths must be under
--   H:\...\Blueprint Families\09_Patterns & Images    or    H:\...\Library\Patterns & Images
-- The full paths: the library root of standards/BLUEPRINT_LIBRARY.md (H:\Shared drives\Barnhaus\Revit\Revit\Blueprint Families\)
-- and the list of the gate script that runbook section names (exports/deubner/mat_audit.py).
-- NOT on the check: the two Autodesk texture folders under C:\Program Files and C:\Program Files (x86) that the same script
-- also allowed. No standard names them (Tony: written sources only). A stock Autodesk material whose texture is not in the H:
-- library then fails this check until the texture is copied there, or Mitch or Michael add the folders on the page.
-- params.texture_folders        = [ "<folder path>", ... ]                what the checker compares the model with
-- params.texture_folders_source = { "<folder path>": "<where it comes from>" } shown under every row on Rulebook > Model checks
--                                 (Tony's requirement, as for the palette: every row names its source, document, section, date)
-- The check's sentence ("Every material's texture files sit in the shared library folders.") already says the folders are the
-- shared library ones, so writing them onto the check is the sentence made readable by the checker, not a change of meaning
-- (rule A83 as ruled for flags 76 and 79): THE CHECK STAYS ACCEPTED, the version goes up, change_note names the runbook and
-- its date. Who accepted it and when are not touched. An approver can change, add or remove a folder on the page.
-- Only where the check carries no folder list yet (safe to run twice; a list somebody has put there is kept).
update public.intent_model_rules
set params = jsonb_build_object(
      'texture_folders', jsonb_build_array(
        $v$H:\Shared drives\Barnhaus\Revit\Revit\Blueprint Families\09_Patterns & Images$v$,
        $v$H:\Shared drives\Barnhaus\Revit\Revit\Library\Patterns & Images$v$),
      'texture_folders_source', jsonb_build_object(
        $v$H:\Shared drives\Barnhaus\Revit\Revit\Blueprint Families\09_Patterns & Images$v$,
        $v$Runbook: standards/D1_TO_D2_RUNBOOK.md, section 8 "Finished-look gate", point (b) (runbook dated 2026-11-08). It says the texture paths of a material must be under "H:\...\Blueprint Families\09_Patterns & Images" or "H:\...\Library\Patterns & Images". This row is the first of the two. The runbook shortens the start of the path; the full path is the library root written in standards/BLUEPRINT_LIBRARY.md (Mitch created the folder on 2026-11-08) followed by 09_Patterns & Images.$v$,
        $v$H:\Shared drives\Barnhaus\Revit\Revit\Library\Patterns & Images$v$,
        $v$Runbook: standards/D1_TO_D2_RUNBOOK.md, section 8 "Finished-look gate", point (b) (runbook dated 2026-11-08). It says the texture paths of a material must be under "H:\...\Blueprint Families\09_Patterns & Images" or "H:\...\Library\Patterns & Images". This row is the second of the two. The runbook shortens the start of the path; the full path is the one in the gate script that section names, exports/deubner/mat_audit.py. standards/DESIGN_BUILD_STANDARD.md section 2 (2026-11-08) names the same folder as the H: Library\Patterns & Images.$v$),
      'initial', true)
      || coalesce(params, '{}'::jsonb),
    change_note = $v$Texture folders added on 2026-11-12 (Tony's ruling of 01:34Z on flag 79): the two shared library folders on H:, taken from the runbook, standards/D1_TO_D2_RUNBOOK.md, section 8 "Finished-look gate", point (b) (runbook dated 2026-11-08). The sentence of this check already says the texture files sit in the shared library folders; the two paths are those folders written out so the checker reads them from here and Mitch or Michael can change the list on this page. What the check proves did not change, so it stays accepted; the version went up. The two Autodesk texture folders under C:\Program Files are not on the list, because no standard names them: a stock Autodesk material fails until its texture is in the H: library or the folders are added here. How the checker judges: for every material in use on what it scanned, a texture file with a full path must lie under one of these folders and exist there, and a texture file with a relative path must exist under one of them; a material in use with no appearance asset fails.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'material.appearance_paths_resolve'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'texture_folders');

-- 2. which tool checks what (as in 20261111t part 4, 20261111u part 2 and 20261112w part 2: a fact about the tooling, not about
--    what a check proves: no version change, no status change). The text says how far the tool has been proven: it passed its
--    tests on prepared data and has not run on a model. material.one_per_role also says what it still lacks: the roles are not
--    on the check (they go to Michael and Mitch as a draft first, Tony 01:34Z), so the tool reports it as not run.
update public.intent_model_rules
set checker = 'automation/checks_materials.py (passes its tests on prepared data; not yet run on a model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('material.no_project_named', 'material.appearance_paths_resolve')
  and checker_status = 'none';

update public.intent_model_rules
set checker = 'automation/checks_materials.py (passes its tests on prepared data; not yet run on a model; the list of roles is not on this check yet, so the tool reports it as not run)',
    checker_status = 'tool',
    updated_at = now()
where rule_key = 'material.one_per_role'
  and checker_status = 'none';

-- 3. say what is left (read in the deploy log)
do $$
declare
  n_acc int; n_prop int; n_wait int; n_tool int; n_rows int; n_notes int;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select count(*) into n_wait from public.intent_model_rules r
    where r.status <> 'retired' and exists (select 1 from jsonb_each(coalesce(r.params, '{}'::jsonb)) e where e.value = 'null'::jsonb);
  select count(*) into n_tool from public.intent_model_rules where checker_status = 'tool';
  select coalesce(jsonb_array_length(r.params -> 'texture_folders'), 0) into n_rows from public.intent_model_rules r where r.rule_key = 'material.appearance_paths_resolve';
  select count(*) into n_notes from public.intent_model_rules r, jsonb_object_keys(coalesce(r.params -> 'texture_folders_source', '{}'::jsonb)) k where r.rule_key = 'material.appearance_paths_resolve';
  raise notice 'model checks after the texture folders: % accepted, % proposed, % waiting for a number, % checked by a tool, % folders on material.appearance_paths_resolve with % notes', n_acc, n_prop, n_wait, n_tool, n_rows, n_notes;
end $$;
