-- MODEL CHECKS: numbers a person can change (Tony rulings 2026-11-11 18:27Z, flags 44 and 45).
-- A check that carries a number (params, e.g. tolerance_ft) gets an edit field on Rulebook > Model checks, approvers only.
-- A tolerance that fails a good model must be fixable in the app, not by a migration.

-- 1. who last changed a number on a check, and when. The number itself stays in params.
alter table public.intent_model_rules add column if not exists params_by text;
alter table public.intent_model_rules add column if not exists params_at timestamptz;

-- 2. flag 45: how far an existing element may be from where the approved drawing shows it before a phase refuses to change
--    it. It was a constant in the work-order compiler (0.25 ft); it becomes a PROPOSED check so every tolerance lives in one
--    editable place. Blueprint also proposes it through POST /api/model-rules; whichever lands first stands.
insert into public.intent_model_rules (rule_key, description, source, kinds, params, status, proposed_by) values
  ('target.element_where_drawn', $v$Before a build phase changes an element that already exists, the element is within the tolerance set on this check of where the approved drawing shows it. If it has moved further than that since the drawing was approved, the phase stops instead of changing it.$v$, $v$was a constant in the work-order compiler; made a check by ruling 2026-11-11 (flag 45, spec amendment A46)$v$, '{}'::text[], '{"tolerance_ft": 0.25, "initial": true}'::jsonb, 'proposed', 'blueprint')
on conflict (rule_key) do nothing;

-- 3. shell.outline_matches_model: its sentence spelled out "0.25 ft (3 in)". The number can now be changed on the page, so
--    the sentence must not repeat it. WORDING ONLY: status, number, version, who accepted it and when are not touched.
--    Only where the sentence is still exactly the one written by 20261111k.
update public.intent_model_rules
set description = $v$After the phase that moves walls, each room whose shape a decision changes matches its approved drawing within the tolerance set on this check. It is a whole-room shape tolerance, not the 1 in casework standard.$v$,
    updated_at = now()
where rule_key = 'shell.outline_matches_model'
  and description = $v$After the phase that moves walls, each room whose shape a decision changes matches its approved drawing within 0.25 ft (3 in). The 0.25 ft is a starting value for Michael to sanity-check: it is a whole-room shape tolerance, not the 1 in casework standard.$v$;
