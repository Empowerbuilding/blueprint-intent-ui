-- MODEL CHECKS: the list of roles goes onto material.one_per_role as Blueprint's reading of the standard, and the check
-- goes back to PROPOSED (Mitch 2026-11-12 02:08Z in blueprint-mitch, spec amendment A96; endorsed by Tony 02:12Z).
-- Mitch: small things that can be adjusted later get a default, not a question. So the gaps of the standard are filled with
-- Blueprint's reading, every such row says "Blueprint's reading, not reviewed", and Mitch or Michael change a row or accept
-- the check on Rulebook > Model checks when they get to it. This replaces the "no value before approval" carry-out of
-- 20261112x; its principle is kept: no ACCEPTED check carries Blueprint's judgment unmarked. The check is not accepted while
-- the values are Blueprint's, and the marking of a row stays on it through an acceptance (Tony 02:12Z).
-- The checker (automation/checks_materials.py) carries no role of its own: it reads params.roles from this check.
--   params.roles        = { "<role>": { "parameters": [..], "material": "<the one material>", "accents": [..] } }
--   params.roles_source = { "<role>": "<the line of the standard it comes from, and what in it is Blueprint's reading>" }
-- SOURCE: standards/DESIGN_BUILD_STANDARD.md (consolidated 2026-11-08), section 2 "Materials (house set, Michael's rule)".
-- The table written out with every gap: reference/intent_v2/ROLES_DRAFT_FOR_MICHAEL.md.
-- ON THE CHECK: the three roles a family parameter carries (casework wood with the accent casework as its allowed accents,
-- countertops, hardware). NOT ON THE CHECK, not judged by it: wet tile, floors, glass, shower wall tile (their material is a
-- layer of a wall type or a floor type, which this checker does not read), and window and door frames.
-- Only where the check carries no roles yet (safe to run twice; a list somebody has put there is kept).
update public.intent_model_rules
set params = jsonb_build_object(
      'roles', jsonb_build_object(
        'Casework wood', jsonb_build_object(
          'parameters', jsonb_build_array('Cabinet Material', 'Door/Drawer Material'),
          'material', 'Cabinets',
          'accents', jsonb_build_array('Cabinets - White Oak', 'Cabinets - Navy', 'Cabinets - Charcoal', 'Cabinets - Gray', 'Cabinets - Steel Gray', 'Cabinets - Walnut')),
        'Countertops', jsonb_build_object(
          'parameters', jsonb_build_array('Counter Top Material'),
          'material', 'Counter Top',
          'accents', jsonb_build_array()),
        'Hardware', jsonb_build_object(
          'parameters', jsonb_build_array('Handle Material'),
          'material', 'Metal - Black Matte',
          'accents', jsonb_build_array())),
      'roles_source', jsonb_build_object(
        'Casework wood', $v$Blueprint's reading, not reviewed. From standards/DESIGN_BUILD_STANDARD.md (2026-11-08), section 2. Material: line 27 says all wood and casework (kitchen, vanities, closets, shelves, hood shroud, island) use "Cabinets". Parameters: line 37 names "Cabinet Material", "Door/Drawer Material" and "Handle Material" as the parameters of the stock casework without saying which carries the wood; taking the first two is Blueprint's reading. Accents: the five of line 30 (Navy for bar and media, Charcoal for mud lockers, Gray for pantry, Steel Gray for garage, Walnut for bar top and slat wall), which this check allows anywhere in the house because it cannot tell one room from another. "Cabinets - White Oak" is allowed too, which is Blueprint's reading: lines 38 and 39 use that name for the casework wood (the range hood, the Deubner kitchen), so a house built with either name passes. Remove it if only "Cabinets" is meant.$v$,
        'Countertops', $v$Blueprint's reading, not reviewed. From standards/DESIGN_BUILD_STANDARD.md (2026-11-08), section 2. Material: line 28 says all countertops use one shared "Counter Top" material (Michael's default is the Marble 05 look); taking "Counter Top" as the name of the material, not "Marble 05", is Blueprint's reading. Parameter: no standard names it. "Counter Top Material" was read from the Patel model on 2026-11-10 (the family Counter Top w Sink Hole) and is what the Deubner and Patel builds set. A counter family that carries its material under another name is not judged by this row. A walnut bar top (line 30) is not allowed here.$v$,
        'Hardware', $v$Blueprint's reading, not reviewed. From standards/DESIGN_BUILD_STANDARD.md (2026-11-08), section 2. Material: line 29 says hardware and pulls use "Metal - Black Matte" (or bronze). The standard gives no material name for bronze, so no bronze is allowed here until one is typed as an accent. Parameter: line 37 names "Handle Material" among the parameters of the stock casework; taking it as the hardware parameter is Blueprint's reading. Appliances that carry "Handle Material" are judged by this row too. Brass on plumbing (same line) is not judged.$v$),
      'initial', true)
      || coalesce(params, '{}'::jsonb),
    status = 'proposed',
    decided_by = null,
    decided_by_email = null,
    decided_at = null,
    decision_note = $v$Back to proposed on 2026-11-12 (Mitch at 02:08Z: a small thing that can be adjusted later gets a default, not a question). This check was accepted on 2026-11-11 at 18:26Z with the sentence above and no list of roles, so its checker could not run. The list is now on it, taken from section 2 of the design standard (2026-11-08). Where the standard leaves a gap the value is Blueprint's reading, and the row says so: nobody has reviewed those. Change any row here, then accept the check; accepting it without a change adopts the rows as shown. Until then the checker runs and reports, and the check does not gate a build phase. Judged: the three roles a family parameter carries, which are casework wood (with the accent casework as allowed accents), countertops and hardware. Not judged by this check: wet tile, floors, glass and shower wall tile, because their material is a layer of a wall type or a floor type, and window and door frames.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'material.one_per_role'
  and status <> 'retired'
  and not (coalesce(params, '{}'::jsonb) ? 'roles');

-- 2. the tool behind the check: it no longer lacks its list (a fact about the tooling: no version change)
update public.intent_model_rules
set checker = 'automation/checks_materials.py (passes its tests on prepared data; not yet run on a model)',
    updated_at = now()
where rule_key = 'material.one_per_role'
  and checker_status = 'tool'
  and checker like '%the list of roles is not on this check yet%'
  and coalesce(params, '{}'::jsonb) ? 'roles';

-- 3. say what is left (read in the deploy log)
do $$
declare
  n_acc int; n_prop int; n_wait int; n_roles int; n_notes int;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select count(*) into n_wait from public.intent_model_rules r, jsonb_each(coalesce(r.params, '{}'::jsonb)) e
    where r.status <> 'retired' and e.value = 'null'::jsonb;
  select count(*) into n_roles from public.intent_model_rules r, jsonb_object_keys(coalesce(r.params -> 'roles', '{}'::jsonb)) k where r.rule_key = 'material.one_per_role';
  select count(*) into n_notes from public.intent_model_rules r, jsonb_object_keys(coalesce(r.params -> 'roles_source', '{}'::jsonb)) k where r.rule_key = 'material.one_per_role';
  raise notice 'model checks after the roles: % accepted, % proposed, % numbers waiting for a value, % roles on material.one_per_role with % notes', n_acc, n_prop, n_wait, n_roles, n_notes;
end $$;
