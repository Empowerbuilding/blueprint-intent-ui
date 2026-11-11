-- Step 2a — get the two image buckets ready to go private. Nobody loses or gains sight of an
-- image in this file: it records the current state in the deploy log and makes sure a signed-in
-- user is allowed to read / add / remove files in these two buckets (the app signs links and
-- deletes a project's files as the signed-in user).
-- The switch to private is the next file (20261111c_image_buckets_private.sql).

-- 1. record what is there now (shows up in deploy/log.txt)
do $$
declare r record;
begin
  for r in select id, public from storage.buckets where id in ('intent-inspo', 'intent-outlines') order by id loop
    raise notice 'bucket % public=%', r.id, r.public;
  end loop;
  if not exists (select 1 from storage.buckets where id = 'intent-inspo') then
    raise notice 'bucket intent-inspo DOES NOT EXIST';
  end if;
  for r in
    select policyname, cmd, roles::text as roles, left(coalesce(qual, ''), 160) as qual, left(coalesce(with_check, ''), 160) as chk
    from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname
  loop
    raise notice 'storage.objects policy "%" cmd=% roles=% using=[%] check=[%]', r.policyname, r.cmd, r.roles, r.qual, r.chk;
  end loop;
end $$;

-- 2. signed-in users may read / add / change / remove files in the two intent buckets only
do $$
begin
  drop policy if exists "intent images: signed-in read" on storage.objects;
  drop policy if exists "intent images: signed-in add" on storage.objects;
  drop policy if exists "intent images: signed-in change" on storage.objects;
  drop policy if exists "intent images: signed-in remove" on storage.objects;
  create policy "intent images: signed-in read" on storage.objects
    for select to authenticated using (bucket_id in ('intent-inspo', 'intent-outlines'));
  create policy "intent images: signed-in add" on storage.objects
    for insert to authenticated with check (bucket_id in ('intent-inspo', 'intent-outlines'));
  create policy "intent images: signed-in change" on storage.objects
    for update to authenticated using (bucket_id in ('intent-inspo', 'intent-outlines'))
    with check (bucket_id in ('intent-inspo', 'intent-outlines'));
  create policy "intent images: signed-in remove" on storage.objects
    for delete to authenticated using (bucket_id in ('intent-inspo', 'intent-outlines'));
  raise notice 'intent image policies: in place';
exception when insufficient_privilege then
  -- the app then signs links with the service role instead (lib/storage.ts); nothing is left half-done
  raise notice 'intent image policies: NOT created, insufficient privilege (%)', sqlerrm;
end $$;
