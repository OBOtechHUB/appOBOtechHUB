-- =====================================================================
-- 18) Progetto unico per tutte le app di OBO Hub
-- Da eseguire una volta nell'editor SQL di Supabase (si può rieseguire), dopo il 15 (condivisione-progetti.sql)
-- e il 17 (zavorra-progetti.sql). Non cancella nulla.
-- Il progetto è uno solo (tabella progetti, la stessa di Progettazione LPS, con numero CRM) e contiene le
-- soluzioni di tutte le app: il progetto LPS, i calcoli della zavorra WRR (calcoli_zavorra.progetto_lps),
-- le configurazioni delle torrette e delle prossime app (progetti_soluzioni), i carichi della Mappa con lo stesso CRM.
-- Chi lavora sul progetto (proprietario o colleghi con condivisione attiva) vede e modifica tutte le soluzioni.
-- =====================================================================

create table if not exists public.progetti_soluzioni (
  id            uuid primary key default gen_random_uuid(),
  progetto      uuid references public.progetti (id) on delete set null,
  app           text not null check (app ~ '^[a-z0-9_-]{2,30}$'),
  nome          text not null default '' check (char_length(nome) <= 200),
  dati          jsonb not null default '{}'::jsonb,
  utente        uuid not null default auth.uid() references auth.users (id),
  creata_il     timestamptz not null default now(),
  aggiornata_il timestamptz not null default now(),
  archiviata    boolean not null default false
);
create index if not exists progetti_soluzioni_progetto_idx on public.progetti_soluzioni (progetto, app);
create index if not exists progetti_soluzioni_utente_idx on public.progetti_soluzioni (utente, aggiornata_il desc);
alter table public.progetti_soluzioni enable row level security;
revoke all on public.progetti_soluzioni from anon;
grant select, insert, update on public.progetti_soluzioni to authenticated;

create table if not exists public.progetti_soluzioni_storico (
  id         bigserial primary key,
  soluzione  uuid not null,
  salvata_il timestamptz not null default now(),
  da         uuid default auth.uid(),
  riga       jsonb not null
);
alter table public.progetti_soluzioni_storico enable row level security;
revoke all on public.progetti_soluzioni_storico from anon, authenticated;
grant select on public.progetti_soluzioni_storico to authenticated;
drop policy if exists "storico soluzioni admin" on public.progetti_soluzioni_storico;
create policy "storico soluzioni admin" on public.progetti_soluzioni_storico for select to authenticated using (public.e_admin());

create or replace function public.modifica_soluzione() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.progetti_soluzioni_storico (soluzione, riga) values (old.id, to_jsonb(old));
  new.utente = old.utente; new.creata_il = old.creata_il; new.aggiornata_il = now();
  return new;
end; $$;
drop trigger if exists modifica_soluzione on public.progetti_soluzioni;
create trigger modifica_soluzione before update on public.progetti_soluzioni for each row execute function public.modifica_soluzione();

drop policy if exists "soluzioni lettura" on public.progetti_soluzioni;
create policy "soluzioni lettura" on public.progetti_soluzioni for select to authenticated
  using (utente = auth.uid() or public.e_admin() or (progetto is not null and public.puo_lavorare(progetto)));
drop policy if exists "soluzioni inserimento" on public.progetti_soluzioni;
create policy "soluzioni inserimento" on public.progetti_soluzioni for insert to authenticated
  with check (utente = auth.uid() and public.utente_abilitato() and (progetto is null or public.puo_lavorare(progetto)));
drop policy if exists "soluzioni modifica" on public.progetti_soluzioni;
create policy "soluzioni modifica" on public.progetti_soluzioni for update to authenticated
  using (utente = auth.uid() or (progetto is not null and public.puo_lavorare(progetto)))
  with check (utente = auth.uid() or (progetto is not null and public.puo_lavorare(progetto)));
-- nessuna regola di cancellazione: una soluzione si archivia (archiviata = true), non si cancella

-- carichi della Mappa con lo stesso numero CRM del progetto (solo lettura, per chi è abilitato)
create or replace function public.carichi_progetto(p_progetto uuid)
returns table (nome text, persona text, priorita text, inizio text, giorni numeric, ore_giorno numeric)
language plpgsql stable security definer set search_path = public as $$
declare c text;
begin
  if not public.puo_lavorare(p_progetto) and not public.e_admin() then return; end if;
  select trim(codice) into c from public.progetti where id = p_progetto;
  if coalesce(c, '') = '' or to_regclass('public.app_projects') is null then return; end if;
  return query execute
    'select name, person, prio, start_date, days, hpd from public.app_projects where not example and lower(trim(crm)) = lower($1) order by start_date nulls last'
    using c;
end; $$;
grant execute on function public.carichi_progetto(uuid) to authenticated;
