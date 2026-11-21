-- STUDY SET LIVE (2026-11-21). The process "Full set to Study set" goes from draft to live, so a work order can be compiled
-- from the accepted pack stages/study_set/ (pack version 1, synced: 2 standards documents + stages/study_set/pack.json).
-- PUT IN SERVICE ON: Mitch, tony-mitch 2026-11-21 23:42Z: "ok so thewres nothing else eft for me to do but wait for blueprint
--   to finsih then i can pull up real projects and the deisgn intent app and start making study sets and engineering lite sets"
--   (portal read by Blueprint 23:47Z); Tony, blueprint-mitch 23:28Z: "move stages/_draft/study_set to accepted per your
--   doctrine, flip study_set draft->live in intent_processes".
-- As a migration through the normal deploy, not a row flip by hand (Tony, blueprint-mitch 2026-11-21 22:25Z).
-- Nothing else changes. eng_frame_lite stays a draft: its smoke test passed, but no tool writes its frame board yet.
-- To take it back: update public.intent_processes set status = 'draft' where key = 'study_set';
update public.intent_processes set status = 'live' where key = 'study_set' and status = 'draft';
