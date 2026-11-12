-- Inspiration pictures feed the 2D drawings (Mitch 2026-11-12 02:24Z, spec A97).
-- A picture carries the layout details the vision analysis read out of it: up to 8 short facts a floor plan can
-- show (island with seating on one side, range on the back wall, double vanity ...). They go into the typed
-- contract with the picture, and the 2D drawing phase gets them next to the file.
-- analyzed_at: when the picture was last read; null = never read with layout details.
alter table public.intent_inspo_images add column if not exists layout_details jsonb not null default '[]'::jsonb;
alter table public.intent_inspo_images add column if not exists analyzed_at timestamptz;
comment on column public.intent_inspo_images.layout_details is 'list of short texts: what a floor plan can show of this picture, read by the vision analysis (spec A97). Replaced as a whole when the picture is read again.';
comment on column public.intent_inspo_images.analyzed_at is 'when the picture was last read by the vision analysis; null = not read since layout details exist';
