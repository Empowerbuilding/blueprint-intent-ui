-- KINDS OF WORK: a kind can carry a number, and the fence kind gets its first one (Tony ruling 2026-11-11 20:56Z, decision 2;
-- spec amendment A69: "the fence rule: decided by the compiler when the geometric split is clean (flat pad = wall type,
-- terrain = hosted railing); otherwise a judgment slot whose default is the wall type").
-- The compiler (Blueprint, automation/work_order_compile_v2.py) now decides between the two fence recipes from a reading of
-- what lies under the fence line. One number is needed for that: how far the heights under the line may differ and still
-- count as flat. It is not a constant in the compiler: it lives here, on the kind, where Mitch or Michael type it
-- (params.flat_max_in, inches). It is put on the kind WITHOUT a value (null), as the numbers on the model checks that nothing
-- written states (rules A83 and A95): none is guessed. Until it has a value the rule decides no fence, and every fence is a
-- decision point on the build plan whose default is the wall type (the ruling's own fallback).
--   params       the numbers of a kind: { "<name>_<unit>": number or null }      null = waiting for a value
--   params_note  what the numbers mean, in plain words (shown under the field)
--   params_by / params_at  who last changed a number, and when
-- Nothing existing is removed. A kind with no numbers keeps params null. Safe to run twice.

alter table public.intent_kinds add column if not exists params jsonb;
alter table public.intent_kinds add column if not exists params_note text;
alter table public.intent_kinds add column if not exists params_by text;
alter table public.intent_kinds add column if not exists params_at timestamptz;

update public.intent_kinds
set params = coalesce(params, '{}'::jsonb) || '{"flat_max_in": null}'::jsonb,
    params_note = $v$How far the heights under a fence line may differ, in inches, and still count as flat. A floor, slab or pad under the whole line that stays within this number takes the fence wall type. Terrain under the whole line that differs by more than this number takes a railing hosted on the terrain. Everything else (both under one line, flat terrain, a sloped floor, or nothing read under the line) is a decision point on the build plan whose default is the wall type. No value has been written anywhere, so none is set: until Mitch or Michael type one, every fence is such a decision point.$v$,
    status_note = $v$Two recipes have run, each measured by its own script. The build plan picks one by rule: a flat host under the whole fence line (pad, slab, floor) takes the fence wall type; terrain that is not flat takes a railing hosted on it. Where the rule cannot tell, a person decides and the default is the wall type.$v$
where kind = 'site.fence'
  and not (coalesce(params, '{}'::jsonb) ? 'flat_max_in');

-- say what is there (read in the deploy log)
do $$
declare
  n_with int; n_wait int; v text;
begin
  select count(*) into n_with from public.intent_kinds where params is not null and params <> '{}'::jsonb;
  select count(*) into n_wait from public.intent_kinds k, jsonb_each(coalesce(k.params, '{}'::jsonb)) e where e.value = 'null'::jsonb;
  select k.params::text into v from public.intent_kinds k where k.kind = 'site.fence';
  raise notice 'kinds of work after the fence number: % kind(s) carry numbers, % number(s) waiting for a value, site.fence params %', n_with, n_wait, v;
end $$;
