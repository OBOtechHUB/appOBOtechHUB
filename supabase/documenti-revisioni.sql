-- =====================================================================
-- Progettazione LPS · Documenti delle revisioni emesse
-- Si esegue una volta in Supabase → SQL Editor. Si può rieseguire.
-- Crea lo spazio di archivio privato "revisioni-documenti": quando un progetto è emesso, la relazione,
-- i documenti dell'impianto, l'offerta e il pacchetto CAD creati vengono copiati nella cartella della
-- revisione (<utente>/<progetto>/Rev<X>/). Le copie non si possono sovrascrivere né cancellare.
-- L'utente vede le proprie copie, l'admin le vede tutte. Nessun dato esistente viene toccato.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('revisioni-documenti', 'revisioni-documenti', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "revdoc_inserimento" on storage.objects;
create policy "revdoc_inserimento" on storage.objects for insert to authenticated
  with check (bucket_id = 'revisioni-documenti' and (storage.foldername(name))[1] = (select auth.uid())::text and public.utente_abilitato());

drop policy if exists "revdoc_lettura" on storage.objects;
create policy "revdoc_lettura" on storage.objects for select to authenticated
  using (bucket_id = 'revisioni-documenti' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.e_admin()));
