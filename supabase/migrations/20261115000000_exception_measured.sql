-- intent_check_exceptions: structured recorded measured value (text). The compile check enforces
-- "the ruling covers this measured value or better" (min rules) / unchanged geometry (vision);
-- the quote stays human-readable provenance, measured is the machine-readable side (bare number
-- in the rule's display unit; check_key disambiguates the rule and its units).
ALTER TABLE intent_check_exceptions ADD COLUMN IF NOT EXISTS measured text;
