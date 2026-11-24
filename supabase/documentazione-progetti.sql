-- =====================================================================
-- 16) Documentazione del progetto LPS (primo passo: planimetrie, prospetti, relazioni, zone ATEX…)
-- Da eseguire una volta nell'editor SQL di Supabase (si può rieseguire), dopo il 15 (condivisione-progetti.sql).
-- Crea lo spazio privato "documentazione-progetti" (<utente>/<progetto>/<file>), fino a 50 MB a file.
-- I file non si sovrascrivono e non si cancellano. Li vede chi lavora sul progetto (proprietario e colleghi
-- con condivisione attiva) e l'amministratore. Nessun dato esistente viene toccato.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentazione-progetti', 'documentazione-progetti', false, 52428800, null)
on conflict (id) do nothing;

drop policy if exists "documentazione_inserimento" on storage.objects;
create policy "documentazione_inserimento" on storage.objects for insert to authenticated
  with check (bucket_id = 'documentazione-progetti'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
    and public.puo_lavorare(((storage.foldername(name))[2])::uuid));

drop policy if exists "documentazione_lettura" on storage.objects;
create policy "documentazione_lettura" on storage.objects for select to authenticated
  using (bucket_id = 'documentazione-progetti' and (
    public.e_admin()
    or ((storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' and public.puo_lavorare(((storage.foldername(name))[2])::uuid))));
-- nessuna regola di modifica o cancellazione: i documenti restano.
