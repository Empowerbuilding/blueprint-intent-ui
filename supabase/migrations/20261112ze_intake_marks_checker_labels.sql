-- MODEL CHECKS: the five intake checks of pack phase P1 and the marks check of P3 and P11 name their tool (M3 prep A6A7,
-- the reconcile that run 14 left: nine checks named no checker, six of them have had one all along).
-- A fact about the tooling, not about what a check proves (as in 20261111t part 4, 20261111u part 2, 20261112w part 2,
-- 20261112x part 2, 20261112za part 3 and 20261112zb): no version change, no status change, nothing else on the check is touched.
--   P1  automation/checks_intake.py judges all eight intake checks; three of them already name a later tool that judges
--       them the same way. It ran on the scratch model in the M2 run of P1 (2026-11-11 19:35Z, 8 of 8 measured).
--   P3, P11  opening.marks_clean: automation/checks_openings.py (ran on the scratch model, one door, 2026-11-11 20:36Z)
--       and run.py qa-marks (passes its tests; it has not looked at a client model since its fix).
-- THREE CHECKS STAY WITHOUT A CHECKER, on purpose:
--   shell.outline_matches_model, shell.rooms_still_enclosed: no checker is built before the pilot (Tony 2026-11-12 01:12Z,
--       spec A92). The compiler refuses a work order with a shell phase while they name none.
--   target.element_where_drawn: no tool; the phase checks it before it changes an existing element.
-- Only where the check names no checker yet (safe to run twice; a label somebody has put there is kept).
update public.intent_model_rules
set checker = 'automation/checks_intake.py (ran on the scratch model, 8 of 8 measured; not yet run on a client model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('doc.is_d2_save_as', 'intake.doc_title_matches', 'intake.fingerprint_current', 'intake.rooms_match_contract', 'room.no_duplicate_numbers')
  and checker_status = 'none';

update public.intent_model_rules
set checker = 'automation/checks_openings.py (ran on the scratch model, one door) and run.py qa-marks (passes its tests; not yet run on a client model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key = 'opening.marks_clean'
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
  raise notice 'model checks after the intake and marks labels: % accepted, % proposed, % checked by a tool, % with no checker named', n_acc, n_prop, n_tool, n_none;
end $$;
