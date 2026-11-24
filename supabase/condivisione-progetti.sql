-- =====================================================================
-- 15) Condivisione e passaggio dei progetti LPS (anche per il sopralluogo)
-- Da eseguire una volta nell'editor SQL di Supabase (si può rieseguire). Non cancella nulla:
--  - il proprietario condivide il progetto con un collega (per email dell'account OBO Hub): il collega lo vede
--    tra i suoi progetti, lo modifica e fa il sopralluogo (foto e vocali visibili a tutti e due);
--  - la condivisione si toglie senza cancellare la riga (attiva = false, con la data);
--  - il proprietario può passare il progetto a un'altra persona: diventa sua, e chi lo passa resta tra le
--    persone con cui è condiviso (non perde l'accesso). Eliminare il progetto resta solo del proprietario.
-- =====================================================================

create table if not exists public.progetti_condivisioni (
  progetto     uuid not null references public.progetti (id) on delete cascade,
  utente       uuid not null references auth.users (id),
  email        text not null default '',
  attiva       boolean not null default true,
  aggiunta_da  uuid default auth.uid(),
  aggiunta_il  timestamptz not null default now(),
  revocata_il  timestamptz,
  primary key (progetto, utente)
);
alter table public.progetti_condivisioni enable row level security;
revoke all on public.progetti_condivisioni from anon, authenticated;

-- l'utente può lavorare sul progetto: proprietario o condivisione attiva
create or replace function public.puo_lavorare(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.progetti x where x.id = p and x.utente = auth.uid())
      or exists (select 1 from public.progetti_condivisioni c where c.progetto = p and c.utente = auth.uid() and c.attiva);
$$;
grant execute on function public.puo_lavorare(uuid) to authenticated;

drop policy if exists "progetti_condivisi_lettura" on public.progetti;
create policy "progetti_condivisi_lettura" on public.progetti for select to authenticated
  using (exists (select 1 from public.progetti_condivisioni c where c.progetto = progetti.id and c.utente = (select auth.uid()) and c.attiva));
drop policy if exists "progetti_condivisi_modifica" on public.progetti;
create policy "progetti_condivisi_modifica" on public.progetti for update to authenticated
  using (exists (select 1 from public.progetti_condivisioni c where c.progetto = progetti.id and c.utente = (select auth.uid()) and c.attiva))
  with check (exists (select 1 from public.progetti_condivisioni c where c.progetto = progetti.id and c.utente = (select auth.uid()) and c.attiva));

-- il proprietario non cambia con un salvataggio; solo con trasferisci_progetto (impostazione di sessione)
create or replace function public.modifica_progetto_lps() returns trigger language plpgsql set search_path = public as $$
begin
  new.data_modifica = now();
  if coalesce(current_setting('lps.trasferimento', true), '') <> 'si' then new.utente = old.utente; end if;
  return new;
end; $$;

create or replace function public.trova_utente_email(p_email text) returns uuid
language sql stable security definer set search_path = public as $$
  select utente from public.accessi_profili where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.trova_utente_email(text) from public, anon, authenticated;

create or replace function public.condividi_progetto(p_progetto uuid, p_email text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare u uuid;
begin
  if not exists (select 1 from public.progetti where id = p_progetto and utente = auth.uid()) then raise exception 'solo il proprietario può condividere il progetto'; end if;
  u := public.trova_utente_email(p_email);
  if u is null then raise exception 'nessun account OBO Hub con questa email'; end if;
  if u = auth.uid() then raise exception 'il progetto è già tuo'; end if;
  insert into public.progetti_condivisioni(progetto, utente, email, attiva, aggiunta_da, aggiunta_il, revocata_il)
    values (p_progetto, u, lower(trim(p_email)), true, auth.uid(), now(), null)
    on conflict (progetto, utente) do update set attiva = true, revocata_il = null, aggiunta_da = auth.uid(), aggiunta_il = now();
  perform public.registra_accesso('condivisione_progetto', jsonb_build_object('progetto', p_progetto, 'con', lower(trim(p_email))));
  return lower(trim(p_email));
end; $$;

create or replace function public.togli_condivisione(p_progetto uuid, p_utente uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from public.progetti where id = p_progetto and utente = auth.uid()) then raise exception 'solo il proprietario può togliere la condivisione'; end if;
  update public.progetti_condivisioni set attiva = false, revocata_il = now() where progetto = p_progetto and utente = p_utente;
end; $$;

create or replace function public.condivisioni_progetto(p_progetto uuid)
returns table (utente uuid, email text, nome text, attiva boolean, aggiunta_il timestamptz, proprietario boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.puo_lavorare(p_progetto) then raise exception 'progetto non disponibile'; end if;
  return query
    select p.utente, coalesce(a.email, ''), coalesce(a.nome, ''), true, p.data_creazione, true from public.progetti p left join public.accessi_profili a on a.utente = p.utente where p.id = p_progetto
    union all
    select c.utente, c.email, coalesce(a.nome, ''), c.attiva, c.aggiunta_il, false from public.progetti_condivisioni c left join public.accessi_profili a on a.utente = c.utente where c.progetto = p_progetto;
end; $$;

create or replace function public.progetti_condivisi_con_me()
returns table (id uuid, codice text, nome text, comune text, data_creazione timestamptz, data_modifica timestamptz, proprietario_email text, proprietario_nome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.codice, p.nome, p.comune, p.data_creazione, p.data_modifica, coalesce(a.email, ''), coalesce(a.nome, '')
  from public.progetti_condivisioni c join public.progetti p on p.id = c.progetto left join public.accessi_profili a on a.utente = p.utente
  where c.utente = auth.uid() and c.attiva order by p.data_modifica desc;
$$;

create or replace function public.trasferisci_progetto(p_progetto uuid, p_email text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare u uuid; vecchio uuid := auth.uid();
begin
  if not exists (select 1 from public.progetti where id = p_progetto and utente = vecchio) then raise exception 'solo il proprietario può passare il progetto'; end if;
  u := public.trova_utente_email(p_email);
  if u is null then raise exception 'nessun account OBO Hub con questa email'; end if;
  if u = vecchio then raise exception 'il progetto è già tuo'; end if;
  perform set_config('lps.trasferimento', 'si', true);
  update public.progetti set utente = u where id = p_progetto;
  perform set_config('lps.trasferimento', '', true);
  -- il nuovo proprietario non è più tra le condivisioni; chi lo passa resta condiviso
  update public.progetti_condivisioni set attiva = false, revocata_il = now() where progetto = p_progetto and utente = u;
  insert into public.progetti_condivisioni(progetto, utente, email, attiva, aggiunta_da)
    values (p_progetto, vecchio, coalesce((select email from public.accessi_profili where utente = vecchio), ''), true, vecchio)
    on conflict (progetto, utente) do update set attiva = true, revocata_il = null;
  perform public.registra_accesso('passaggio_progetto', jsonb_build_object('progetto', p_progetto, 'a', lower(trim(p_email))));
  return lower(trim(p_email));
end; $$;

grant execute on function public.condividi_progetto(uuid, text), public.togli_condivisione(uuid, uuid), public.condivisioni_progetto(uuid), public.progetti_condivisi_con_me(), public.trasferisci_progetto(uuid, text) to authenticated;

-- foto e vocali del sopralluogo: li vede chi lavora sul progetto (cartella <utente>/<progetto>/…)
drop policy if exists "sopralluoghi_lettura_condivisi" on storage.objects;
create policy "sopralluoghi_lettura_condivisi" on storage.objects for select to authenticated
  using (bucket_id = 'sopralluoghi' and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$' and public.puo_lavorare(((storage.foldername(name))[2])::uuid));
