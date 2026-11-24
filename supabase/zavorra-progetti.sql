-- =====================================================================
-- 17) Zavorra telai inverter WRR: calcoli come progetti (salvataggio automatico) e telai a parete
-- Da eseguire una volta nell'editor SQL di Supabase (si può rieseguire), dopo il 14 (zavorra-wrr.sql)
-- e il 15 (condivisione-progetti.sql). Non cancella nessun dato:
--  - ammette anche i telai a parete WRR W1000 (5904005) e W1500 (5904007);
--  - ogni calcolo ha numero CRM, data di aggiornamento e può essere collegato a un progetto di Progettazione LPS;
--  - il calcolo aperto si aggiorna da solo; ogni versione precedente resta in calcoli_zavorra_storico;
--  - lo vedono e lo modificano anche i colleghi con cui il progetto LPS collegato è condiviso.
-- =====================================================================

-- telai ammessi: si sostituisce solo la regola di controllo (nessuna riga toccata)
do $$
declare c text;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.calcoli_zavorra'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%telaio%'
  loop execute format('alter table public.calcoli_zavorra drop constraint %I', c); end loop;
end $$;
alter table public.calcoli_zavorra add constraint calcoli_zavorra_telaio_check
  check (telaio in ('F1000','F1500','D1000','D1500','W1000','W1500'));

alter table public.calcoli_zavorra add column if not exists codice_crm text check (char_length(codice_crm) <= 100);
alter table public.calcoli_zavorra add column if not exists progetto_lps uuid references public.progetti (id) on delete set null;
alter table public.calcoli_zavorra add column if not exists aggiornato_il timestamptz;
alter table public.calcoli_zavorra disable trigger user;  -- la data dei calcoli già salvati non crea versioni nello storico
update public.calcoli_zavorra set aggiornato_il = created_at where aggiornato_il is null;
alter table public.calcoli_zavorra enable trigger user;
alter table public.calcoli_zavorra alter column aggiornato_il set default now();
create index if not exists calcoli_zavorra_lps_idx on public.calcoli_zavorra (progetto_lps);
create index if not exists calcoli_zavorra_agg_idx on public.calcoli_zavorra (user_id, aggiornato_il desc);

-- storico: ogni modifica conserva la versione precedente
create table if not exists public.calcoli_zavorra_storico (
  id         bigserial primary key,
  calcolo    uuid not null,
  salvato_il timestamptz not null default now(),
  da         uuid default auth.uid(),
  riga       jsonb not null
);
alter table public.calcoli_zavorra_storico enable row level security;
revoke all on public.calcoli_zavorra_storico from anon, authenticated;
grant select on public.calcoli_zavorra_storico to authenticated;
drop policy if exists "storico zavorra admin" on public.calcoli_zavorra_storico;
create policy "storico zavorra admin" on public.calcoli_zavorra_storico for select to authenticated using (public.e_admin());

create or replace function public.modifica_calcolo_zavorra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.calcoli_zavorra_storico (calcolo, riga) values (old.id, to_jsonb(old));
  new.user_id = old.user_id;          -- il proprietario non cambia
  new.created_at = old.created_at;
  new.aggiornato_il = now();
  return new;
end; $$;
drop trigger if exists modifica_calcolo_zavorra on public.calcoli_zavorra;
create trigger modifica_calcolo_zavorra before update on public.calcoli_zavorra for each row execute function public.modifica_calcolo_zavorra();

-- lettura e modifica: proprietario, colleghi del progetto LPS collegato (condivisione attiva); lettura anche admin
drop policy if exists "leggi propri calcoli" on public.calcoli_zavorra;
create policy "leggi propri calcoli" on public.calcoli_zavorra for select to authenticated
  using (user_id = auth.uid() or public.e_admin() or (progetto_lps is not null and public.puo_lavorare(progetto_lps)));
drop policy if exists "modifica propri calcoli" on public.calcoli_zavorra;
create policy "modifica propri calcoli" on public.calcoli_zavorra for update to authenticated
  using (user_id = auth.uid() or (progetto_lps is not null and public.puo_lavorare(progetto_lps)))
  with check (user_id = auth.uid() or (progetto_lps is not null and public.puo_lavorare(progetto_lps)));
drop policy if exists "inserisci propri calcoli" on public.calcoli_zavorra;
create policy "inserisci propri calcoli" on public.calcoli_zavorra for insert to authenticated
  with check (user_id = auth.uid() and (progetto_lps is null or public.puo_lavorare(progetto_lps)));
-- nessuna policy di cancellazione: i calcoli restano
