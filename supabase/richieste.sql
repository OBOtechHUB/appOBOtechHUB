-- =====================================================================
-- Richieste all'ufficio tecnico (Progettazione LPS + Mappa carichi)
-- Si esegue una volta in Supabase → SQL Editor. Si può rieseguire.
-- Aggiunge solo tabelle e funzioni nuove: nessun dato esistente viene modificato o cancellato.
-- - In Progettazione LPS (pagina Richieste) chi ha l'account apre una richiesta, il tecnico la prende
--   in carico, crea il progetto LPS collegato e la chiude.
-- - In Mappa carichi (pagina Richieste) il tecnico vede le richieste aperte e le "mette in mappa":
--   diventa un progetto della Mappa con le ore stimate.
-- NIENTE SI CANCELLA: una richiesta si annulla (stato "annullata"); ogni modifica salva prima la
-- versione precedente in richieste_storico.
-- =====================================================================

create table if not exists public.richieste_tecniche (
  id uuid primary key default gen_random_uuid(),
  creata_il timestamptz not null default now(),
  creata_da uuid default auth.uid(),
  richiedente text not null default '' check (char_length(richiedente) <= 200),
  cliente text not null default '' check (char_length(cliente) <= 300),
  comune text not null default '' check (char_length(comune) <= 200),
  tipo text not null default 'progetto-lps' check (tipo in ('progetto-lps','verifica','offerta','consulenza','altro')),
  descrizione text not null default '' check (char_length(descrizione) <= 5000),
  priorita text not null default 'Media' check (priorita in ('Alta','Media','Bassa')),
  scadenza date,
  ore_stimate numeric(7,1) check (ore_stimate is null or (ore_stimate >= 0 and ore_stimate <= 2000)),
  stato text not null default 'nuova' check (stato in ('nuova','in-carico','in-lavorazione','completata','annullata')),
  tecnico text not null default '' check (char_length(tecnico) <= 200),
  progetto uuid,                -- progetto LPS collegato (senza vincolo: la richiesta resta anche se il progetto viene eliminato)
  progetto_mappa text,          -- id del progetto in Mappa carichi
  aggiornata_il timestamptz not null default now()
);
create index if not exists richieste_stato on public.richieste_tecniche(stato, creata_il desc);

create table if not exists public.richieste_storico (
  sid bigserial primary key,
  richiesta uuid not null,
  dati jsonb not null,
  modificata_da uuid default auth.uid(),
  salvata_il timestamptz not null default now()
);
create index if not exists richieste_storico_r on public.richieste_storico(richiesta);

-- prima di ogni modifica: copia della versione precedente nello storico
create or replace function public._richieste_storia() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.richieste_storico(richiesta, dati) values (old.id, to_jsonb(old));
  new.aggiornata_il := now();
  new.id := old.id; new.creata_il := old.creata_il; new.creata_da := old.creata_da;
  return new;
end $$;
drop trigger if exists richieste_storia on public.richieste_tecniche;
create trigger richieste_storia before update on public.richieste_tecniche for each row execute function public._richieste_storia();

alter table public.richieste_tecniche enable row level security;
alter table public.richieste_storico enable row level security;
grant select, insert, update on public.richieste_tecniche to authenticated;
grant select on public.richieste_storico to authenticated;
grant all on public.richieste_tecniche, public.richieste_storico to service_role;

drop policy if exists "richieste_lettura" on public.richieste_tecniche;
create policy "richieste_lettura" on public.richieste_tecniche for select to authenticated using (public.utente_abilitato());
drop policy if exists "richieste_inserimento" on public.richieste_tecniche;
create policy "richieste_inserimento" on public.richieste_tecniche for insert to authenticated with check (public.utente_abilitato() and creata_da = (select auth.uid()));
drop policy if exists "richieste_modifica" on public.richieste_tecniche;
create policy "richieste_modifica" on public.richieste_tecniche for update to authenticated using (public.utente_abilitato()) with check (public.utente_abilitato());
drop policy if exists "richieste_storico_lettura" on public.richieste_storico;
create policy "richieste_storico_lettura" on public.richieste_storico for select to authenticated using (public.e_admin());

-- ---------------------------------------------------------------- Mappa carichi (sessioni della Mappa)
create or replace function public._richiesta_json(r public.richieste_tecniche) returns jsonb
language sql immutable set search_path = public as $$
  select jsonb_build_object('id', r.id, 'creata', to_char(r.creata_il at time zone 'Europe/Rome', 'YYYY-MM-DD'), 'richiedente', r.richiedente, 'cliente', r.cliente,
    'comune', r.comune, 'tipo', r.tipo, 'descrizione', r.descrizione, 'priorita', r.priorita, 'scadenza', to_char(r.scadenza, 'YYYY-MM-DD'),
    'ore', r.ore_stimate, 'stato', r.stato, 'tecnico', r.tecnico, 'progetto_mappa', r.progetto_mappa, 'progetto_lps', r.progetto is not null);
$$;

-- richieste aperte e chiuse negli ultimi 60 giorni (Admin e colleghi; il Visitatore no)
create or replace function public.app_richieste_list(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.app_sessions;
begin
  s := public._sess(p->>'token');
  if s.role not in ('admin','guest') then raise exception 'NON_AUTORIZZATO'; end if;
  return jsonb_build_object('items', (
    select coalesce(jsonb_agg(public._richiesta_json(r) order by (r.stato in ('completata','annullata')), r.scadenza nulls last, r.creata_il), '[]'::jsonb)
    from public.richieste_tecniche r
    where r.stato not in ('completata','annullata') or r.aggiornata_il > now() - interval '60 days'));
end $$;

-- mette la richiesta in Mappa: progetto della persona (il collega per sé, l'Admin per chi sceglie) con le ore stimate
create or replace function public.app_richieste_in_mappa(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.app_sessions; r public.richieste_tecniche; persona text; pid text; ore numeric; giorni numeric; inizio date;
begin
  s := public._sess(p->>'token');
  if s.role not in ('admin','guest') then raise exception 'NON_AUTORIZZATO'; end if;
  select * into r from public.richieste_tecniche where id = (p->>'id')::uuid;
  if r.id is null then return jsonb_build_object('error', 'Richiesta non trovata.'); end if;
  if r.progetto_mappa is not null then return jsonb_build_object('error', 'Richiesta già in Mappa.'); end if;
  persona := case when s.role = 'admin' then coalesce(nullif(btrim(p->>'person'), ''), s.name) else s.name end;
  if not exists (select 1 from public.app_people where name = persona) then return jsonb_build_object('error', 'Persona non presente nella Mappa.'); end if;
  ore := greatest(1, coalesce(r.ore_stimate, 8));
  giorni := ceil(ore / 8);
  inizio := coalesce((p->>'start')::date, (now() at time zone 'Europe/Rome')::date);
  pid := 'ric-' || replace(r.id::text, '-', '');
  insert into public.app_projects(id, person, name, crm, prio, start_date, days, hpd, dates, example, updated_at)
  values (pid, persona, left(concat_ws(' – ', nullif(r.cliente, ''), nullif(r.comune, ''), case r.tipo when 'progetto-lps' then 'Progetto LPS' when 'verifica' then 'Verifica' when 'offerta' then 'Offerta' when 'consulenza' then 'Consulenza' else 'Richiesta' end), 200),
          '', r.priorita, to_char(inizio, 'YYYY-MM-DD'), giorni, round(ore / giorni, 1), null, false, now());
  update public.richieste_tecniche set progetto_mappa = pid, tecnico = persona, stato = case when stato = 'nuova' then 'in-carico' else stato end where id = r.id;
  return jsonb_build_object('ok', true, 'id', pid);
end $$;

grant execute on function public.app_richieste_list(jsonb), public.app_richieste_in_mappa(jsonb) to anon, authenticated;
