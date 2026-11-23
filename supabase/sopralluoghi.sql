-- =====================================================================
-- Progettazione LPS · Foto dei sopralluoghi
-- Si esegue una volta in Supabase → SQL Editor. Si può rieseguire.
-- Crea lo spazio privato "sopralluoghi" per le foto scattate dal tablet o dal telefono
-- (<utente>/<progetto>/<foto>.jpg). Le foto non si sovrascrivono e non si cancellano.
-- L'utente vede le proprie, l'admin le vede tutte. Nessun dato esistente viene toccato.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sopralluoghi', 'sopralluoghi', false, 10485760, array['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/x-m4a','audio/aac','audio/mpeg','audio/ogg','audio/wav'])
on conflict (id) do nothing;

drop policy if exists "sopralluoghi_inserimento" on storage.objects;
create policy "sopralluoghi_inserimento" on storage.objects for insert to authenticated
  with check (bucket_id = 'sopralluoghi' and (storage.foldername(name))[1] = (select auth.uid())::text and public.utente_abilitato());

drop policy if exists "sopralluoghi_lettura" on storage.objects;
create policy "sopralluoghi_lettura" on storage.objects for select to authenticated
  using (bucket_id = 'sopralluoghi' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.e_admin()));
