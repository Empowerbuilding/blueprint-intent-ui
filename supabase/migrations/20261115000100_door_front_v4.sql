-- door_clearance_36 semantics refined (v3 -> v4): a door with no wall face falls back to the old
-- nearest-distance measure for that door (never silently passes an unmeasured door), and a pass
-- now carries the measured in-front depth instead of a bare "clear" (agrees numerically with
-- Blueprint's local check port). Aligned 2026-11-15 per blueprint-mitch.
UPDATE intent_rules SET version = version + 1, updated_at = now()
WHERE rule_key = 'door_clearance_36' AND active = true;
