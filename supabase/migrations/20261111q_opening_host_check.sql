-- MODEL CHECK opening.bbox_verified: host wall and position across the wall (Tony ruling 2026-11-11 20:56Z, decision 3,
-- flag 48, spec amendment A70: "Host-wall check: go ahead. Into the app as the check, tolerance approver-editable").
-- Before: the check proved a placed door or window sat where it was placed ALONG its wall, in the wall the build phase
-- itself named. Now the checker (Blueprint, automation/checks_openings.py) works out the host wall from the approved
-- drawing and the walls of the model, and measures the insertion point across that wall as well as along it.
-- 1. The sentence says what the check now proves. The check stays the same check (same key, same status, same person
--    who accepted it); the version goes up because its meaning changed (a work order compiled before this is stale).
-- 2. The host search margin (how far past half the wall's thickness the search for the host wall reaches) was a number
--    in the proposal (2 in). It becomes a number ON the check, next to the tolerance, so Mitch or Michael can change it
--    on Rulebook > Model checks. The checker has no fallback for it: without it the check is reported as not run.
-- Only where the check carries no margin yet (safe to run twice).

update public.intent_model_rules
set description = $v$Every placed or swapped door and window is in the wall the approved drawing puts it in, and sits where it was drawn: along that wall and on its centreline, each within the tolerance set on this check. The checker works the wall out itself from the drawing and the model, not from what the build phase says: it is the one wall behind the wall face the mark sits on, no further back than half the wall's thickness plus the host search margin set on this check. When it finds no such wall, or more than one, the check is reported as not run, never as passed. It does not check the swing side or the hand of a door.$v$,
    params = coalesce(params, '{}'::jsonb) || '{"host_search_margin_in": 2}'::jsonb,
    version = version + 1,
    updated_at = now()
where rule_key = 'opening.bbox_verified' and not (coalesce(params, '{}'::jsonb) ? 'host_search_margin_in');
