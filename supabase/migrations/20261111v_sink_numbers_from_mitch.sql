-- MODEL CHECKS: the two numbers of sink.cutout_matches_bowl get the values Mitch gave (blueprint-mitch, 2026-11-11 23:41Z:
-- "the 2 numbers are good", answering the two values put to him at 23:16Z; verbatim in the spec amendments of that day).
--   tolerance_in    = 0.25    each side of the cutout within 1/4 in of the same side of the bowl
--   rim_gap_max_in  = 0.125   the rim within 1/8 in of the top of the slab or of its underside still counts as level / touching
-- Migration 20261111t put both on the check WITHOUT a value (rule A83: a number the sentence does not state is never
-- guessed; it is Mitch's or Michael's). The values are his; they are written here by Blueprint because he gave them in the
-- channel and not on the page.
-- THE CHECK STAYS PROPOSED. Accepting it is Mitch's or Michael's click on Rulebook > Model checks; nothing here accepts it.
-- A value that somebody has typed on the page in the meantime is kept: only a number that still has no value is set.
-- Safe to run twice (the second time no number is without a value).
update public.intent_model_rules
set params = coalesce(params, '{}'::jsonb)
      || case when params -> 'tolerance_in' = 'null'::jsonb then '{"tolerance_in": 0.25}'::jsonb else '{}'::jsonb end
      || case when params -> 'rim_gap_max_in' = 'null'::jsonb then '{"rim_gap_max_in": 0.125}'::jsonb else '{}'::jsonb end
      || '{"initial": true}'::jsonb,
    params_by = 'Blueprint, with the values Mitch gave in blueprint-mitch',
    params_at = now(),
    change_note = $v$Numbers set on 2026-11-11: tolerance 0.25 in and rim gap 0.125 in. They are the two values Mitch confirmed in blueprint-mitch at 23:41Z ("the 2 numbers are good"), written here by Blueprint because he gave them in the channel and not on this page. Either can be changed here. The check is still to accept.$v$,
    decision_note = replace(decision_note,
      'No value is set for either and none was guessed: Mitch or Michael type them here and accept the check again.',
      'Mitch gave both values in blueprint-mitch on 2026-11-11 at 23:41Z (tolerance 0.25 in, rim gap 0.125 in) and they are set on the check: Mitch or Michael accept the check again here.'),
    version = version + 1,
    updated_at = now()
where rule_key = 'sink.cutout_matches_bowl'
  and status <> 'retired'
  and (params -> 'tolerance_in' = 'null'::jsonb or params -> 'rim_gap_max_in' = 'null'::jsonb);

do $$
declare
  n_acc int; n_prop int; n_wait int;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select count(*) into n_wait from public.intent_model_rules r
    where r.status <> 'retired' and exists (select 1 from jsonb_each(coalesce(r.params, '{}'::jsonb)) e where e.value = 'null'::jsonb);
  raise notice 'model checks after the sink numbers: % accepted, % proposed, % waiting for a number', n_acc, n_prop, n_wait;
end $$;
