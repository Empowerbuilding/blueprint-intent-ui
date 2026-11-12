-- MODEL CHECKS: the four floor and ceiling checks of pack phase P8 and the two final checks of pack phase P12 name their tool.
-- A fact about the tooling, not about what a check proves (as in 20261111t part 4, 20261111u part 2, 20261112w part 2,
-- 20261112x part 2 and 20261112za part 3): no version change, no status change, nothing else on the check is touched.
-- The text says how far each tool has been proven: it passed its tests on prepared data and has not run on a model.
--   P8  automation/checks_floors.py  (written 2026-11-12 00:22Z, M3 prep A2; that run made no migration, so the label was left)
--   P12 automation/checks_final.py   (written 2026-11-12, M3 prep A3 part 6). It makes no bridge call: it reads the reports of
--       run.py qa-model and run.py qa-marks, the result of the sheet checker and the PDF, all taken in the final phase.
-- material.appearance_paths_resolve, the third key of the P12 exit, already names automation/checks_materials.py.
-- Only where the check names no checker yet (safe to run twice; a label somebody has put there is kept).
update public.intent_model_rules
set checker = 'automation/checks_floors.py (passes its tests on prepared data; not yet run on a model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('floor.threshold_both_sides', 'floor.no_uncovered_slab', 'ceiling.edge_z_measured', 'model.warnings_not_up')
  and checker_status = 'none';

update public.intent_model_rules
set checker = 'automation/checks_final.py (passes its tests on prepared data; not yet run on a model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('final.qa_clean', 'final.pdf_exists')
  and checker_status = 'none';

-- say what is left (read in the deploy log)
do $$
declare
  n_acc int; n_prop int; n_tool int; n_none int;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select count(*) into n_tool from public.intent_model_rules where checker_status = 'tool';
  select count(*) into n_none from public.intent_model_rules where checker_status = 'none' and status <> 'retired';
  raise notice 'model checks after the floor and final labels: % accepted, % proposed, % checked by a tool, % with no checker named', n_acc, n_prop, n_tool, n_none;
end $$;
