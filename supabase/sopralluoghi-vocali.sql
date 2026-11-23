-- =====================================================================
-- Progettazione LPS · Messaggi vocali del sopralluogo (12° SQL)
-- Si esegue una volta in Supabase → SQL Editor, dopo sopralluoghi.sql. Si può rieseguire.
-- Permette di salvare anche file audio (messaggi vocali registrati dal telefono) nello spazio
-- privato "sopralluoghi", accanto alle foto. Non cancella e non modifica nessun file o dato:
-- aggiunge solo i tipi audio a quelli ammessi (stesse regole: ognuno i suoi, l'admin tutti).
-- =====================================================================

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct t) from unnest(coalesce(allowed_mime_types, array[]::text[]) || array[
    'image/jpeg','image/png','image/webp',
    'audio/webm','audio/mp4','audio/x-m4a','audio/aac','audio/mpeg','audio/ogg','audio/wav'
  ]) as t
)
where id = 'sopralluoghi';

select id, allowed_mime_types from storage.buckets where id = 'sopralluoghi';
