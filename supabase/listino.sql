-- =====================================================================
-- Progettazione LPS · Listino prezzi OBO (formato METEL)
-- Si esegue una volta in Supabase → SQL Editor. Si può rieseguire.
-- Aggiunge solo tabelle nuove: nessun dato esistente viene modificato o cancellato.
-- Il listino lo carica l'admin dall'app (Amministrazione → Listino prezzi) dal file METEL
-- scaricato da https://www.obo.it/it-it/risorse/mediateca/downloads.
-- Ogni caricamento è una versione nuova: le versioni precedenti restano (nessun UPDATE o DELETE).
-- Lo leggono solo gli utenti con account abilitato (non i visitatori).
-- =====================================================================

create table if not exists public.listino_versioni (
  versione text primary key check (char_length(versione) between 1 and 60),
  nome_file text not null default '' check (char_length(nome_file) <= 200),
  righe integer not null default 0,
  caricato_il timestamptz not null default now(),
  caricato_da uuid not null default auth.uid()
);

create table if not exists public.listino_obo (
  versione text not null, -- la versione viene registrata in listino_versioni solo a caricamento completo
  codice text not null check (char_length(codice) between 1 and 40),
  ean text not null default '' check (char_length(ean) <= 20),
  descrizione text not null default '' check (char_length(descrizione) <= 300),
  prezzo numeric(12,4) not null check (prezzo >= 0),          -- prezzo al rivenditore per `moltiplicatore` unità
  prezzo_pubblico numeric(12,4) not null default 0 check (prezzo_pubblico >= 0),
  moltiplicatore integer not null default 1 check (moltiplicatore > 0),
  unita text not null default 'PCE' check (char_length(unita) <= 10),
  confezione integer not null default 1,
  famiglia_sconto text not null default '' check (char_length(famiglia_sconto) <= 20),
  stato smallint not null default 0,
  variazione text not null default '' check (char_length(variazione) <= 10),
  primary key (versione, codice)
);

alter table public.listino_versioni enable row level security;
alter table public.listino_obo enable row level security;
grant select, insert on public.listino_versioni, public.listino_obo to authenticated;
grant all on public.listino_versioni, public.listino_obo to service_role;

drop policy if exists "listino_versioni_lettura" on public.listino_versioni;
create policy "listino_versioni_lettura" on public.listino_versioni for select to authenticated using (public.utente_abilitato());
drop policy if exists "listino_versioni_admin" on public.listino_versioni;
create policy "listino_versioni_admin" on public.listino_versioni for insert to authenticated with check (public.e_admin());

drop policy if exists "listino_lettura" on public.listino_obo;
create policy "listino_lettura" on public.listino_obo for select to authenticated using (public.utente_abilitato());
drop policy if exists "listino_admin" on public.listino_obo;
create policy "listino_admin" on public.listino_obo for insert to authenticated with check (public.e_admin());

create index if not exists listino_obo_codice on public.listino_obo(codice);
