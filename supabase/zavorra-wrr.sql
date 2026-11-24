-- =====================================================================
-- 14) Archivio calcoli dell'app "Zavorra telai inverter WRR" di OBO Hub (zavorra-wrr/)
-- Da eseguire una volta nell'editor SQL di Supabase (si può rieseguire). Non cancella nulla.
-- Ogni utente vede e modifica solo i propri calcoli; i calcoli non si cancellano (storico sempre conservato).
-- =====================================================================
create table if not exists public.calcoli_zavorra (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id),
  created_at       timestamptz not null default now(),
  cliente          text check (char_length(cliente) <= 120),
  progetto         text check (char_length(progetto) <= 160),
  telaio           text not null check (telaio in ('F1000','F1500','D1000','D1500')),
  inclinazione     smallint not null check (inclinazione in (30,45)),
  vento            numeric not null,
  metodo           text not null check (metodo in ('prudent','obo','interp')),
  apparecchiature  jsonb not null default '[]'::jsonb,
  risultato_kg     numeric,
  per_lato_kg      numeric,
  da_verificare    boolean not null default false,
  tabella          jsonb,
  stato            jsonb
);
create index if not exists calcoli_zavorra_user_created_idx on public.calcoli_zavorra (user_id, created_at desc);
alter table public.calcoli_zavorra enable row level security;

drop policy if exists "leggi propri calcoli" on public.calcoli_zavorra;
create policy "leggi propri calcoli" on public.calcoli_zavorra for select to authenticated using (user_id = auth.uid() or public.e_admin());
drop policy if exists "inserisci propri calcoli" on public.calcoli_zavorra;
create policy "inserisci propri calcoli" on public.calcoli_zavorra for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "modifica propri calcoli" on public.calcoli_zavorra;
create policy "modifica propri calcoli" on public.calcoli_zavorra for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- nessuna policy di cancellazione: i calcoli restano
grant select, insert, update on public.calcoli_zavorra to authenticated;
