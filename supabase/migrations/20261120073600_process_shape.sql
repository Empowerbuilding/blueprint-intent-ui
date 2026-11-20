-- PROCESS SHAPE (Mitch, blueprint-mitch 2026-11-20 07:33Z: "for engineerering it shoudlnt have to scan the rooms though
-- why is it in ui"; 07:34Z "go").
-- The project page said "Waiting on the room board: Blueprint pushes the rooms from the model scan" and offered
-- "Generate standard room set" for every process. An engineering project has no rooms and no room scan: its board is one
-- house-level section of frame lines pushed from the engineer's set, and it has no 2D drawing step (the set is its 2D).
-- The two facts live on the process row, so a new process says its own shape and the pages need no code change.
--   board  rooms = a room board from the model scan; frame = frame lines from the engineer's set, no rooms
--   has_2d false = the progress steps go board, review, lock, build (no 2D step)
-- The pages also work before this has run (src/lib/processes.ts: SHAPE_WHEN_NOT_SAID).
alter table public.intent_processes add column if not exists board text not null default 'rooms';
alter table public.intent_processes add column if not exists has_2d boolean not null default true;
alter table public.intent_processes drop constraint if exists intent_processes_board_check;
alter table public.intent_processes add constraint intent_processes_board_check check (board in ('rooms', 'frame'));
comment on column public.intent_processes.board is 'What the board of this process is made of: rooms (pushed from the model scan) or frame (frame lines from the engineer''s set; no rooms, no room scan)';
comment on column public.intent_processes.has_2d is 'Whether the process has a 2D drawing step between Lock & Emit and the build';

update public.intent_processes set board = 'frame', has_2d = false where key = 'eng_frame';
