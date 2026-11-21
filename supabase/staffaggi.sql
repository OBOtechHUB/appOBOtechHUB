-- =====================================================================
-- Staffaggi OBO: progetti di staffaggio (binari MS, mensole, passerelle KTS)
-- Si esegue una volta in Supabase → SQL Editor. Si può rieseguire.
-- Aggiunge solo tabelle nuove: nessun dato esistente viene modificato o cancellato.
-- Ogni utente vede e modifica i propri progetti; l'admin li vede tutti (sola lettura).
-- NIENTE SI CANCELLA: un progetto si archivia (archiviato = true); ogni modifica salva prima la
-- versione precedente in staffaggi_storico.
-- =====================================================================

create table if not exists public.staffaggi_progetti (
  id uuid primary key default gen_random_uuid(),
  utente uuid not null default auth.uid(),
  codice text not null default '' check (char_length(codice) <= 60),
  nome text not null default '' check (char_length(nome) <= 200),
  cliente text not null default '' check (char_length(cliente) <= 200),
  dati jsonb not null default '{}'::jsonb check (pg_column_size(dati) <= 2000000),
  archiviato boolean not null default false,
  creato_il timestamptz not null default now(),
  modificato_il timestamptz not null default now()
);
create index if not exists staffaggi_utente on public.staffaggi_progetti(utente, modificato_il desc);

create table if not exists public.staffaggi_storico (
  sid bigserial primary key,
  progetto uuid not null,
  dati jsonb not null,
  salvata_il timestamptz not null default now()
);
create index if not exists staffaggi_storico_p on public.staffaggi_storico(progetto, salvata_il desc);

-- prima di ogni modifica: copia della versione precedente (al massimo una ogni 10 minuti per progetto)
create or replace function public._staffaggi_storia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.staffaggi_storico s where s.progetto = old.id and s.salvata_il > now() - interval '10 minutes') then
    insert into public.staffaggi_storico(progetto, dati) values (old.id, to_jsonb(old));
  end if;
  new.id := old.id; new.utente := old.utente; new.creato_il := old.creato_il; new.modificato_il := now();
  return new;
end $$;
drop trigger if exists staffaggi_storia on public.staffaggi_progetti;
create trigger staffaggi_storia before update on public.staffaggi_progetti for each row execute function public._staffaggi_storia();

alter table public.staffaggi_progetti enable row level security;
alter table public.staffaggi_storico enable row level security;
grant select, insert, update on public.staffaggi_progetti to authenticated;
grant select on public.staffaggi_storico to authenticated;
grant all on public.staffaggi_progetti, public.staffaggi_storico to service_role;

drop policy if exists "staffaggi_lettura" on public.staffaggi_progetti;
create policy "staffaggi_lettura" on public.staffaggi_progetti for select to authenticated
  using (public.utente_abilitato() and (utente = (select auth.uid()) or public.e_admin()));
drop policy if exists "staffaggi_inserimento" on public.staffaggi_progetti;
create policy "staffaggi_inserimento" on public.staffaggi_progetti for insert to authenticated
  with check (public.utente_abilitato() and utente = (select auth.uid()));
drop policy if exists "staffaggi_modifica" on public.staffaggi_progetti;
create policy "staffaggi_modifica" on public.staffaggi_progetti for update to authenticated
  using (public.utente_abilitato() and utente = (select auth.uid())) with check (utente = (select auth.uid()));
drop policy if exists "staffaggi_storico_lettura" on public.staffaggi_storico;
create policy "staffaggi_storico_lettura" on public.staffaggi_storico for select to authenticated
  using (exists (select 1 from public.staffaggi_progetti p where p.id = progetto and (p.utente = (select auth.uid()) or public.e_admin())));
