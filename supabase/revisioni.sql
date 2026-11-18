-- =====================================================================
-- Progettazione LPS · Archivio delle revisioni emesse
-- Si esegue una volta in Supabase → SQL Editor. Si può rieseguire.
-- Aggiunge solo una tabella nuova: nessun dato esistente viene modificato o cancellato.
-- Ogni revisione emessa viene copiata qui e non si può né modificare né cancellare
-- (nessuna regola di UPDATE o DELETE per gli utenti): è lo storico delle emissioni.
-- =====================================================================

create table if not exists public.progetti_revisioni (
  id uuid primary key default gen_random_uuid(),
  progetto uuid not null, -- senza vincolo: le revisioni emesse restano anche se il progetto viene eliminato
  utente uuid not null default auth.uid(),
  rev text not null check (char_length(rev) between 1 and 10),
  data timestamptz not null default now(),
  autore text not null default '' check (char_length(autore) <= 200),
  descrizione text not null default '' check (char_length(descrizione) <= 1000),
  impronta text not null default '' check (char_length(impronta) <= 40),
  dati jsonb not null,
  unique (progetto, rev)
);

alter table public.progetti_revisioni enable row level security;
grant select, insert on public.progetti_revisioni to authenticated;
grant all on public.progetti_revisioni to service_role;

drop policy if exists "revisioni_lettura_proprie" on public.progetti_revisioni;
create policy "revisioni_lettura_proprie" on public.progetti_revisioni for select to authenticated
  using (utente = (select auth.uid()));

drop policy if exists "revisioni_inserimento_proprie" on public.progetti_revisioni;
create policy "revisioni_inserimento_proprie" on public.progetti_revisioni for insert to authenticated
  with check (utente = (select auth.uid())
              and exists (select 1 from public.progetti p where p.id = progetto and p.utente = (select auth.uid())));

create index if not exists progetti_revisioni_progetto on public.progetti_revisioni(progetto, data desc);
