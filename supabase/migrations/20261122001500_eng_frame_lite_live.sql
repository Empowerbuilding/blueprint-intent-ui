-- ENG FRAME LITE LIVE (2026-11-22). The process "Framing Package - Lite (catalog)" goes from draft to live, so a work order
-- can be compiled from the accepted pack stages/eng_frame_lite/ (pack version 1, synced).
-- ACCEPTED BY: Mitch, blueprint-mitch 2026-11-21 23:49:46Z: "Accept study set and lite" (read from the portal by Blueprint
--   2026-11-22 00:02Z). The same words are the acceptance of study_set, which went live at 23:51:59Z on his 23:42Z message.
-- As a migration through the normal deploy, not a row flip by hand (Tony, blueprint-mitch 2026-11-21 22:25Z).
-- What live does NOT mean yet: no tool writes the Lite frame board (the intake push asks for an engineer's set revision), so a
-- Lite project stops at the board step until that tool exists; a frame laid out with no engineer's set has never run.
-- To take it back: update public.intent_processes set status = 'draft' where key = 'eng_frame_lite';
update public.intent_processes set status = 'live' where key = 'eng_frame_lite' and status = 'draft';
