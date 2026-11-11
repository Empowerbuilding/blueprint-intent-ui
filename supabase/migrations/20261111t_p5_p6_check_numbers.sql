-- MODEL CHECKS: the numbers the P5 (casework) and P6 (counters and sinks) checkers read go onto their checks
-- (Tony ruling 2026-11-11 22:51Z, flag 64, spec amendment A83). The checkers (Blueprint, automation/checks_casework.py and
-- automation/checks_counters.py) carry no number of their own: each one is read from the check here (params).
-- THE RULE (A83):
--   a number the ACCEPTED SENTENCE ALREADY STATES is the sentence made readable by the checker, not a change of meaning:
--     the check stays accepted, the version goes up, change_note says where the number came from;
--   a number the sentence does NOT state is a new claim: the check goes back to proposed (A81), and the number is put on
--     the check WITHOUT a value (null). Its value is Mitch's or Michael's to type on Rulebook > Model checks. None is guessed.
-- A number that is present with no value (null) = "waiting for a value": the checker reports the gate as not run.
--   casework.position_within_1in_of_2d   tolerance_in = 1     from its sentence ("within 1 inch")       stays accepted (part 1)
--   casework.no_opening_intersection     clear_depth_in       not in its sentence, no written source     back to proposed (part 2)
--   sink.cutout_matches_bowl             tolerance_in         not in its sentence                         back to proposed (part 3)
--   sink.cutout_matches_bowl             rim_gap_max_in       not in its sentence; the sentence itself is
--                                                             rewritten after Mitch 23:14Z (flag 68)       (part 3)
-- NOT added: overlap_allow_in (absent = nothing allowed, which is the accepted sentence read literally).
-- Each part only where the check does not carry the number yet (safe to run twice).

-- 1. casework.position_within_1in_of_2d: "Built casework sits within 1 inch of the approved 2D drawing."
--    The 1 inch of the sentence becomes params.tolerance_in. Status, who accepted it and when are not touched.
update public.intent_model_rules
set params = coalesce(params, '{}'::jsonb) || '{"tolerance_in": 1, "initial": true}'::jsonb,
    change_note = $v$Number added on 2026-11-11 (rule A83, Tony 22:51Z): tolerance 1 in. It is the 1 inch this check's own sentence states, written as a number so the checker reads it from here and Mitch or Michael can change it on this page. What the check proves did not change, so it stays accepted; the version went up.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'casework.position_within_1in_of_2d'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'tolerance_in');

-- 2. casework.no_opening_intersection: "No casework crosses a door, window or appliance."
--    Its checker proves two things: no casework reaches INTO the box of a door, a window or an appliance (no number needed),
--    and no casework stands IN FRONT of a door or window, within a clear depth out from the wall. The sentence states no
--    depth and nothing written gives one, so it is a new claim: back to proposed, the number present without a value.
update public.intent_model_rules
set params = coalesce(params, '{}'::jsonb) || '{"clear_depth_in": null}'::jsonb,
    status = 'proposed',
    decided_by = null,
    decided_by_email = null,
    decided_at = null,
    decision_note = $v$Back to proposed on 2026-11-11 (rule A83, Tony 22:51Z). This check was accepted at 18:26Z with the sentence above and no number. Its checker now needs one the sentence does not state: the clear depth, which is how far out from the wall the space in front of a door or window has to stay free of casework (a base cabinet under a window sill is below that space and is not counted). Nobody has written that depth down, so no value is set and none was guessed: Mitch or Michael type it here and accept the check again. Until then it does not gate a build phase.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'casework.no_opening_intersection'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'clear_depth_in');

-- 3. sink.cutout_matches_bowl. Accepted as: "Each counter cutout equals its sink bowl, the sink is centred, the rim is under
--    the slab." Two changes, both of meaning (A81, A83), so it goes back to proposed:
--    a. WHERE THE RIM SITS (Mitch 2026-11-11 23:14Z in blueprint-mitch, flag 68: "pretty close to level with the countertops
--       or ... butting up right underneath the countertops, but essentially touching it", depending on the type of sink).
--       The sentence is rewritten to say so. The checker passes a rim at the top of the slab or at its underside, and
--       fails a rim anywhere else.
--    b. TWO NUMBERS the old sentence did not state: the tolerance ("equals", "centred") and the rim gap ("level",
--       "touching"). Both are put on the check without a value. Mitch was asked for both at 23:17Z.
--    The note also says what the checker measures as the bowl (flag 66), so the new acceptance covers it.
--    A value that is already on the check is kept (existing keys win over the two empty ones).
update public.intent_model_rules
set description = $v$Each counter cutout equals its sink bowl and the sink is centred in it: each side of the cutout is within the tolerance set on this check of the same side of the bowl. The rim of the sink is level with the countertop or directly under it, touching: within the rim gap set on this check of the top of the slab or of its underside. A rim anywhere else fails.$v$,
    params = '{"tolerance_in": null, "rim_gap_max_in": null}'::jsonb || coalesce(params, '{}'::jsonb),
    status = 'proposed',
    decided_by = null,
    decided_by_email = null,
    decided_at = null,
    decision_note = $v$Back to proposed on 2026-11-11 (rules A81 and A83). This check was accepted at 18:26Z as: each counter cutout equals its sink bowl, the sink is centred, the rim is under the slab. Two things changed since. Its sentence now says where the rim may sit, after Mitch at 23:14Z: level with the countertop or directly under it, touching, depending on the type of sink. And its checker needs two numbers the old sentence did not state: the tolerance (how far each side of the cutout may be from the same side of the bowl) and the rim gap (how far the rim may be from the top of the slab, or from its underside, and still count as level or touching). No value is set for either and none was guessed: Mitch or Michael type them here and accept the check again. What the checker measures as the bowl is the inside of the sink at its rim, not the outside of its walls: say so if the outside is meant. Until then the check does not gate a build phase.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'sink.cutout_matches_bowl'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'rim_gap_max_in');

-- 4. which tool checks what. The page said "no checker written yet" for checks that now have one. This is a fact about
--    the tooling, not about what a check proves: no version change, no status change. The text says how far each tool has
--    been proven, because a tool that passed its tests has not thereby run on a model.
update public.intent_model_rules
set checker = 'automation/checks_casework.py (passes its tests on prepared data; not yet run on a model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('casework.no_overlap', 'casework.no_opening_intersection', 'casework.position_within_1in_of_2d', 'casework.faces_have_material')
  and checker_status = 'none';
update public.intent_model_rules
set checker = 'automation/checks_counters.py (passes its tests on prepared data; not yet run on a model)',
    checker_status = 'tool',
    updated_at = now()
where rule_key in ('sink.cutout_matches_bowl', 'counter.no_builtin_splash')
  and checker_status = 'none';
update public.intent_model_rules
set checker = 'automation/checks_openings.py (ran read-only on the scratch model, one door)',
    checker_status = 'tool',
    updated_at = now()
where rule_key = 'opening.bbox_verified'
  and checker_status = 'none';

-- 5. say what is left (read in the deploy log)
do $$
declare
  n_acc int; n_prop int; n_wait int; n_tool int;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select count(*) into n_wait from public.intent_model_rules r
    where r.status <> 'retired' and exists (select 1 from jsonb_each(coalesce(r.params, '{}'::jsonb)) e where e.value = 'null'::jsonb);
  select count(*) into n_tool from public.intent_model_rules where checker_status = 'tool';
  raise notice 'model checks after the P5 and P6 numbers: % accepted, % proposed, % waiting for a number, % checked by a tool', n_acc, n_prop, n_wait, n_tool;
end $$;
