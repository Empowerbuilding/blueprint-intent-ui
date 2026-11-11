-- MODEL CHECK shell.outline_matches_model: put the shell tolerance on the proposed check (Tony ruling 2026-11-11 08:59Z, flag 28).
-- 0.25 ft is the INITIAL value, for Michael's sanity-check: a whole-room shape tolerance, not the 1 inch casework standard.
-- The compiler reads params.tolerance_ft from this check. Only touched while it is still proposed and carries no number:
-- a check a person has decided on is never rewritten here.

update public.intent_model_rules
set description = $v$After the phase that moves walls, each room whose shape a decision changes matches its approved drawing within 0.25 ft (3 in). The 0.25 ft is a starting value for Michael to sanity-check: it is a whole-room shape tolerance, not the 1 in casework standard.$v$,
    params = '{"tolerance_ft": 0.25, "initial": true}'::jsonb,
    source = 'spec amendment A12; 0.25 ft is the initial value (ruling 2026-11-11)',
    version = version + 1,
    updated_at = now()
where rule_key = 'shell.outline_matches_model' and status = 'proposed' and not (params ? 'tolerance_ft');
