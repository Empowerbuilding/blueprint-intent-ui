-- door_clearance_36: measure the clear space in front of the door (its span extended min_in into
-- the room), not the nearest corner-to-corner distance in any direction. The old measure failed
-- fixtures that merely sit BESIDE a door on the same wall (Whitaker pilot: Bath 2 25.5", Half Bath
-- 34.5", Master Bath 26.5", ADU Bath 13.7" - all accepted by ruling; the rule was blunt, not the
-- rooms wrong). Version bump keeps the compiler fingerprint honest. Coordinated with Blueprint's
-- local check copy (it ports the same change; see blueprint-mitch 2026-11-14).
UPDATE intent_rules
SET params = params || '{"measure":"door_front"}'::jsonb,
    version = version + 1,
    updated_at = now()
WHERE rule_key = 'door_clearance_36' AND active = true;
