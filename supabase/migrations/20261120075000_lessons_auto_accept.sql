-- LESSONS: NOTHING WAITS FOR A CLICK (Mitch, blueprint-mitch 2026-11-20 07:46Z: "why do i still see all these lesson
-- that want me to accept, like ive said many times all this needs to be autonomous i shoudlnt have to manayuly acceot
-- anythign"; 07:47Z "deploy").
-- Until now a lesson a person taught landed accepted (auto-learn, 2026-11-15) but Blueprint's own findings waited as
-- proposed for Mitch or Michael. From this deploy POST /api/lessons stores Blueprint's own finding as accepted, marked
-- decided_by_email = 'Blueprint (own finding, not reviewed)'. This migration accepts the ones already waiting, with
-- the same mark and a note that says why. Nothing is deleted; an approver can retire any of them.
-- The policies are unchanged: a signed-in account that is not an approver still cannot decide a lesson.
do $$
declare n int;
begin
  update public.intent_lessons
     set status = 'accepted',
         accepted_rule = proposed_rule,
         accepted_at = now(),
         decided_at = now(),
         decided_by_email = 'Blueprint (own finding, not reviewed)',
         decision_note = 'Accepted automatically, not read by a person. Mitch 2026-11-20 07:46Z: all this needs to be autonomous. Retire it if it is wrong.'
   where status = 'proposed' and source = 'blueprint';
  get diagnostics n = row_count;
  raise notice 'lessons accepted automatically: %', n;
end $$;
