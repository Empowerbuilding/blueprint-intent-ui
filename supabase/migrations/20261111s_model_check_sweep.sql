-- MODEL CHECKS: one sweep after the rule on changed checks (Tony ruling 2026-11-11 21:58Z, flag 61, spec amendment A81).
-- THE RULE: a change of MEANING on an accepted check (what passes or fails, new numbers, new claims) puts it back to
-- proposed, for Mitch or Michael to accept again. An edit of WORDING or format that does not change what the check
-- proves keeps the acceptance, with the version going up and a note saying what changed.
-- The sweep looked at all 41 accepted checks (analysis: Blueprint, reference/intent_v2/FLAGS.md flag 61):
--   opening.bbox_verified        meaning changed after it was accepted  -> back to proposed (part 2)
--   shell.outline_matches_model  wording only after it was accepted     -> stays accepted, version up, note (part 3)
--   target.element_where_drawn   accepted after its number was set, sentence unchanged -> untouched
--   the other 38                 unchanged since they were seeded       -> untouched

-- 1. a place for "what was last edited on this check, outside a decision". decision_note stays what it is: the note that
--    goes with a decision (accept, retire, and here the reset). Shown on Rulebook > Model checks, returned by the API.
alter table public.intent_model_rules add column if not exists change_note text;

-- 2. opening.bbox_verified goes back to PROPOSED. It was accepted 2026-11-11 18:26Z as "Every placed or swapped door and
--    window exists where it was placed." After that: a tolerance number was put on it (20261111m, 20:17Z), then its
--    sentence was rewritten to the host-wall meaning and a host search margin was added (20261111q, 21:36Z). Who accepted
--    it and when are cleared, because nobody has accepted THIS sentence. The sentence and the numbers are not touched.
--    Only where the acceptance on record is older than the new sentence: an acceptance given after 21:36Z is of the new
--    sentence and is never undone here (safe to run twice).
update public.intent_model_rules
set status = 'proposed',
    decided_by = null,
    decided_by_email = null,
    decided_at = null,
    decision_note = $v$Back to proposed on 2026-11-11 (rule A81, Tony 21:58Z). This check was accepted at 18:26Z as: every placed or swapped door and window exists where it was placed. Since then its sentence changed to the host-wall meaning above, and it gained two numbers: the tolerance (1 in) and the host search margin (2 in). Nobody has accepted the new sentence yet: Mitch or Michael accept it again at the pre-pilot review. Until then it does not gate a build phase.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'opening.bbox_verified'
  and status = 'accepted'
  and decided_at < timestamptz '2026-11-11 21:36:00+00';

-- 3. shell.outline_matches_model stays ACCEPTED. Its sentence was edited after acceptance (20261111l, 18:42Z): it stopped
--    repeating the number, because the number can be changed on the page. What it proves and its number did not change.
--    That edit did not raise the version; the rule says a wording edit does. Version up, and the note says what changed.
--    Status, number, who accepted it and when are not touched. Only once (the note is the marker).
update public.intent_model_rules
set change_note = $v$Wording edit on 2026-11-11 18:42Z, after this check was accepted: the sentence no longer repeats the number (it said 0.25 ft (3 in); it now says the tolerance set on this check), because the number can be changed on this page. What the check proves and its number did not change, so it stays accepted (rule A81). The version went up with this note; the edit itself had not raised it.$v$,
    version = version + 1,
    updated_at = now()
where rule_key = 'shell.outline_matches_model'
  and change_note is null
  and description = $v$After the phase that moves walls, each room whose shape a decision changes matches its approved drawing within the tolerance set on this check. It is a whole-room shape tolerance, not the 1 in casework standard.$v$;

-- 4. say what the sweep left behind (read in the deploy log)
do $$
declare
  n_acc int; n_prop int; o record; s record;
begin
  select count(*) into n_acc from public.intent_model_rules where status = 'accepted';
  select count(*) into n_prop from public.intent_model_rules where status = 'proposed';
  select status, version, decided_at into o from public.intent_model_rules where rule_key = 'opening.bbox_verified';
  select status, version, (change_note is not null) as noted into s from public.intent_model_rules where rule_key = 'shell.outline_matches_model';
  raise notice 'model checks after the sweep: % accepted, % proposed; opening.bbox_verified % v% decided_at %; shell.outline_matches_model % v% note %',
    n_acc, n_prop, o.status, o.version, o.decided_at, s.status, s.version, s.noted;
end $$;
