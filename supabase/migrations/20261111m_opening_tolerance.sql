-- MODEL CHECK opening.bbox_verified: its tolerance lives on the check (Tony ruling 2026-11-11 20:07Z, flag 47).
-- The checker script (Blueprint, automation/checks_openings.py) compared a placed door or window to its drawn position
-- within 1 in, and the 1 in was the script's own number. It becomes a number on the existing check (not a new check),
-- so Mitch or Michael can change it on Rulebook > Model checks. The checker reads params.tolerance_in from here.
-- Only the number is added: the sentence, the status and who accepted the check are not touched. The version goes up
-- because the check changed (a work order compiled before this is stale). Only where the check carries no number yet.

update public.intent_model_rules
set params = coalesce(params, '{}'::jsonb) || '{"tolerance_in": 1, "initial": true}'::jsonb,
    version = version + 1,
    updated_at = now()
where rule_key = 'opening.bbox_verified' and not (coalesce(params, '{}'::jsonb) ? 'tolerance_in');
