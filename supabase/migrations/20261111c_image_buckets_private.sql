-- Step 2b — the two image buckets go private. From here a stored inspo photo or 2D outline can
-- only be opened through a signed link the app makes for a signed-in user (or a machine caller
-- holding the shared secret). Public URLs stop working.
-- The app has served signed links only since 20261111b; verified live before this file.

update storage.buckets set public = false where id in ('intent-inspo', 'intent-outlines');

-- the one older policy on these buckets is covered by "intent images: signed-in read" (20261111b)
-- and its name ("public read") no longer says what it does
do $$
begin
  drop policy if exists "intent inspo public read" on storage.objects;
exception when insufficient_privilege then
  raise notice 'old policy "intent inspo public read" left in place (insufficient privilege); it only allows signed-in read';
end $$;

-- fail the deploy if either bucket is still public, and record the end state
do $$
declare r record; n int;
begin
  select count(*) into n from storage.buckets where id in ('intent-inspo', 'intent-outlines') and public = false;
  if n <> 2 then raise exception 'expected both intent image buckets private, found %', n; end if;
  for r in select id, public from storage.buckets where id in ('intent-inspo', 'intent-outlines') order by id loop
    raise notice 'bucket % public=%', r.id, r.public;
  end loop;
  for r in select policyname, cmd, roles::text as roles from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname loop
    raise notice 'storage.objects policy "%" cmd=% roles=%', r.policyname, r.cmd, r.roles;
  end loop;
end $$;
