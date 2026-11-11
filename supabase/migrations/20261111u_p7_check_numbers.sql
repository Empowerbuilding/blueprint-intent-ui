-- MODEL CHECKS: the numbers the P7 (baths) checker reads go onto their check, and the four bath checks name their tool
-- (Tony ruling 2026-11-11 22:51Z, flag 64, spec amendment A83). The checker (Blueprint, automation/checks_baths.py) carries
-- no number of its own: each one is read from the check here (params).
-- THE RULE (A83), as in 20261111t:
--   a number the ACCEPTED SENTENCE ALREADY STATES is the sentence made readable by the checker, not a change of meaning:
--     the check stays accepted, the version goes up, change_note says where the number came from.
--   plumbing.toilet_clearance_15_21   side_clear_in = 15    from its sentence ("15 inches to each side")     stays accepted
--   plumbing.toilet_clearance_15_21   front_clear_in = 21   from its sentence ("21 inches in front")          stays accepted
-- The other three bath checks (bath.tile_cut_at_openings, bath.niche_void_cut, bath.one_room_per_bath) need no number:
-- their checker allows nothing beyond the rounding of the coordinates. No check goes back to proposed in this migration.
-- Each part only where the check does not carry it yet (safe to run twice).

-- 1. plumbing.toilet_clearance_15_21: "Toilets have 15 inches to each side and 21 inches in front."
--    The 15 and the 21 of the sentence become params.side_clear_in and params.front_clear_in. Status, who accepted it and
--    when are not touched. A value that is already on the check is kept (existing keys win).
update public.intent_model_rules
set params = '{"side_clear_in": 15, "front_clear_in": 21, "initial": true}'::jsonb || coalesce(params, '{}'::jsonb),
    change_note = $v$Numbers added on 2026-11-11 (rule A83, Tony 22:51Z): side clear 15 in and front clear 21 in. They are the 15 inches and the 21 inches this check's own sentence states, written as numbers so the checker reads them from here and Mitch or Michael can change them on this page. What the check proves did not change, so it stays accepted; the version went up. How the checker measures: to each side from the toilet's centreline to the nearest wall, casework, plumbing fixture or generic model beside it; in front from the front of the toilet, over the toilet's own width.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'plumbing.toilet_clearance_15_21'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'side_clear_in');

-- 2. which tool checks what (as part 4 of 20261111t: a fact about the tooling, not about what a check proves: no version
--    change, no status change; flag 70 asks Tony whether such a label change should raise the version). The text says how
--    far the tool has been proven: it passed its tests on prepared data and has not run on a model.
update public.intent_model_rules
set checker = 'automation/checks_baths.py (passes its tests on prepared data; not yet run on a model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('plumbing.toilet_clearance_15_21', 'bath.tile_cut_at_openings', 'bath.niche_void_cut', 'bath.one_room_per_bath')
  and checker_status = 'none';

-- 3. say what is left (read in the deploy log)
do $$
declare
  n_acc int; n_prop int; n_wait int; n_tool int;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select count(*) into n_wait from public.intent_model_rules r
    where r.status <> 'retired' and exists (select 1 from jsonb_each(coalesce(r.params, '{}'::jsonb)) e where e.value = 'null'::jsonb);
  select count(*) into n_tool from public.intent_model_rules where checker_status = 'tool';
  raise notice 'model checks after the P7 numbers: % accepted, % proposed, % waiting for a number, % checked by a tool', n_acc, n_prop, n_wait, n_tool;
end $$;
