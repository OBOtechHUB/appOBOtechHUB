-- =====================================================================
-- 19) Progetti di tutti in sola lettura (pagina Progetti di OBO Hub)
-- Da eseguire una volta nell'editor SQL di Supabase (si può rieseguire), dopo il 18 (progetti-unici.sql).
-- Ogni utente abilitato vede l'elenco di tutti i progetti e le loro soluzioni (zavorra, torrette, carichi della
-- Mappa), anche quelli non condivisi con lui, ma solo in lettura: i dati completi e le modifiche restano al
-- proprietario e ai colleghi con condivisione attiva. Nessuna regola di accesso alle tabelle viene allargata
-- (sono funzioni di sola lettura) e nulla si cancella.
-- =====================================================================

create or replace function public.tutti_i_progetti()
returns table (id uuid, codice text, nome text, comune text, data_modifica timestamptz,
               proprietario uuid, proprietario_nome text, proprietario_email text,
               mio boolean, condiviso boolean, lps boolean, zavorra integer, torrette integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.codice, p.nome, p.comune, p.data_modifica,
         p.utente, coalesce(a.nome, ''), coalesce(a.email, ''),
         p.utente = auth.uid(),
         exists (select 1 from public.progetti_condivisioni c where c.progetto = p.id and c.utente = auth.uid() and c.attiva),
         (p.dati ? 'versione'),
         (select count(*)::int from public.calcoli_zavorra z where z.progetto_lps = p.id),
         (select count(*)::int from public.progetti_soluzioni s where s.progetto = p.id and s.app = 'torrette' and not s.archiviata)
  from public.progetti p
  left join public.accessi_profili a on a.utente = p.utente
  where public.utente_abilitato()
  order by p.data_modifica desc
  limit 2000;
$$;
grant execute on function public.tutti_i_progetti() to authenticated;

-- riepilogo delle soluzioni di un progetto (sola lettura, senza i dati completi)
create or replace function public.soluzioni_progetto(p_progetto uuid)
returns table (app text, id uuid, nome text, dettaglio text, aggiornata_il timestamptz)
language sql stable security definer set search_path = public as $$
  select 'zavorra', z.id, coalesce(nullif(z.progetto, ''), 'Calcolo zavorra'),
         z.telaio || ' · ' || z.vento || ' km/h · ' ||
           case when z.telaio like 'W%' then 'a parete' when z.risultato_kg is null then '–' else z.risultato_kg || ' kg' end,
         coalesce(z.aggiornato_il, z.created_at)
  from public.calcoli_zavorra z where z.progetto_lps = p_progetto and public.utente_abilitato()
  union all
  select s.app, s.id, s.nome, '', s.aggiornata_il
  from public.progetti_soluzioni s where s.progetto = p_progetto and not s.archiviata and public.utente_abilitato()
  order by 5 desc;
$$;
grant execute on function public.soluzioni_progetto(uuid) to authenticated;

-- carichi della Mappa con lo stesso CRM: leggibili da ogni utente abilitato
create or replace function public.carichi_progetto(p_progetto uuid)
returns table (nome text, persona text, priorita text, inizio text, giorni numeric, ore_giorno numeric)
language plpgsql stable security definer set search_path = public as $$
declare c text;
begin
  if not public.utente_abilitato() then return; end if;
  select trim(codice) into c from public.progetti where id = p_progetto;
  if coalesce(c, '') = '' or to_regclass('public.app_projects') is null then return; end if;
  return query execute
    'select name, person, prio, start_date, days, hpd from public.app_projects where not example and lower(trim(crm)) = lower($1) order by start_date nulls last'
    using c;
end; $$;
grant execute on function public.carichi_progetto(uuid) to authenticated;
