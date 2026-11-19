-- =====================================================================
-- Progettazione LPS · Cruscotto di direzione (solo amministratori)
-- Si esegue una volta in Supabase → SQL Editor. Si può rieseguire.
-- Aggiunge solo una funzione di lettura: nessun dato viene modificato o cancellato.
-- Riassume per il periodo scelto: progetti creati e modificati, revisioni emesse e tempi,
-- aste e conduttori OBO prescritti nei progetti, richieste all'ufficio tecnico e ore della Mappa carichi.
-- Le parti che dipendono da script non ancora eseguiti (revisioni, richieste, Mappa) restano vuote.
-- =====================================================================

create or replace function public.cruscotto_direzione(p_da date, p_a date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare out jsonb := '{}'::jsonb; a timestamptz := p_da::timestamptz; b timestamptz := (p_a + 1)::timestamptz; x jsonb;
begin
  if not public.e_admin() then raise exception 'NON_AUTORIZZATO'; end if;
  if p_a < p_da or p_a - p_da > 3660 then raise exception 'PERIODO_NON_VALIDO'; end if;

  -- progetti
  select jsonb_build_object(
    'creati', count(*) filter (where data_creazione >= a and data_creazione < b),
    'modificati', count(*) filter (where data_modifica >= a and data_modifica < b),
    'totale', count(*),
    'per_mese', coalesce((select jsonb_agg(jsonb_build_object('mese', m, 'n', n) order by m) from (
        select to_char(data_creazione at time zone 'Europe/Rome', 'YYYY-MM') m, count(*) n from public.progetti where data_creazione >= a and data_creazione < b group by 1) t), '[]'::jsonb),
    'per_persona', coalesce((select jsonb_agg(jsonb_build_object('nome', nome, 'n', n) order by n desc) from (
        select coalesce(nullif(pr.nome, ''), pr.email, p.utente::text) nome, count(*) n from public.progetti p left join public.accessi_profili pr on pr.utente = p.utente
        where p.data_modifica >= a and p.data_modifica < b group by 1) t), '[]'::jsonb),
    'per_lpl', coalesce((select jsonb_object_agg(l, n) from (
        select coalesce(nullif(dati->'edificio'->>'lplProgetto', ''), dati->'esteso'->>'lpl', '—') l, count(*) n from public.progetti where data_modifica >= a and data_modifica < b group by 1) t), '{}'::jsonb)
  ) into x from public.progetti;
  out := out || jsonb_build_object('progetti', x);

  -- materiale OBO prescritto: aste per codice e conduttori dei progetti modificati nel periodo
  select jsonb_build_object(
    'aste', coalesce((select jsonb_agg(jsonb_build_object('codice', c, 'n', n, 'progetti', np) order by n desc) from (
        select coalesce(nullif(e->>'codiceOBO', ''), '—') c, count(*) n, count(distinct p.id) np
        from public.progetti p, jsonb_array_elements(coalesce(p.dati->'esteso'->'aste', '[]'::jsonb)) e
        where p.data_modifica >= a and p.data_modifica < b group by 1 order by 2 desc limit 25) t), '[]'::jsonb),
    'conduttori', coalesce((select jsonb_agg(jsonb_build_object('codice', c, 'tipo', tp, 'n', n) order by n desc) from (
        select coalesce(nullif(e->>'codiceOBO', ''), '—') c, coalesce(e->>'tipo', '') tp, count(*) n
        from public.progetti p, jsonb_array_elements(coalesce(p.dati->'esteso'->'conduttori', '[]'::jsonb)) e
        where p.data_modifica >= a and p.data_modifica < b group by 1, 2 order by 3 desc limit 25) t), '[]'::jsonb),
    'totale_aste', (select count(*) from public.progetti p, jsonb_array_elements(coalesce(p.dati->'esteso'->'aste', '[]'::jsonb)) e where p.data_modifica >= a and p.data_modifica < b)
  ) into x;
  out := out || jsonb_build_object('materiale', x);

  -- revisioni emesse (supabase/revisioni.sql)
  if to_regclass('public.progetti_revisioni') is not null then
    execute $q$
      select jsonb_build_object(
        'emesse', count(*),
        'per_mese', coalesce((select jsonb_agg(jsonb_build_object('mese', m, 'n', n) order by m) from (
            select to_char(data at time zone 'Europe/Rome', 'YYYY-MM') m, count(*) n from public.progetti_revisioni where data >= $1 and data < $2 group by 1) t), '[]'::jsonb),
        'giorni_prima_emissione', (select round(avg(extract(epoch from (r.data - p.data_creazione)) / 86400)::numeric, 1)
            from public.progetti_revisioni r join public.progetti p on p.id = r.progetto where r.rev = 'A' and r.data >= $1 and r.data < $2)
      ) from public.progetti_revisioni where data >= $1 and data < $2 $q$ into x using a, b;
    out := out || jsonb_build_object('revisioni', x);
  end if;

  -- richieste all'ufficio tecnico (supabase/richieste.sql)
  if to_regclass('public.richieste_tecniche') is not null then
    execute $q$
      select jsonb_build_object(
        'aperte', count(*) filter (where stato not in ('completata','annullata')),
        'nuove_periodo', count(*) filter (where creata_il >= $1 and creata_il < $2),
        'completate_periodo', count(*) filter (where stato = 'completata' and aggiornata_il >= $1 and aggiornata_il < $2),
        'ore_aperte', coalesce(sum(ore_stimate) filter (where stato not in ('completata','annullata')), 0),
        'giorni_medi_chiusura', round(avg(extract(epoch from (aggiornata_il - creata_il)) / 86400) filter (where stato = 'completata' and aggiornata_il >= $1 and aggiornata_il < $2)::numeric, 1),
        'per_tipo', coalesce((select jsonb_object_agg(tipo, n) from (select tipo, count(*) n from public.richieste_tecniche where creata_il >= $1 and creata_il < $2 group by 1) t), '{}'::jsonb),
        'per_stato', coalesce((select jsonb_object_agg(stato, n) from (select stato, count(*) n from public.richieste_tecniche group by 1) t), '{}'::jsonb)
      ) from public.richieste_tecniche $q$ into x using a, b;
    out := out || jsonb_build_object('richieste', x);
  end if;

  -- ore pianificate in Mappa carichi (progetti che iniziano nel periodo)
  if to_regclass('public.app_projects') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('persona', person, 'ore', ore, 'progetti', n) order by ore desc), '[]'::jsonb) from (
        select person, round(sum(case when dates is not null and jsonb_typeof(dates) = 'object' then (select coalesce(sum((v)::numeric), 0) from jsonb_each_text(dates) as d(k, v) where v ~ '^[0-9.]+$') else days * hpd end)::numeric, 1) ore, count(*) n
        from public.app_projects where not example and start_date ~ '^\d{4}-\d{2}-\d{2}$' and start_date::date between $1::date and $2::date group by person) t $q$
      into x using p_da, p_a;
    out := out || jsonb_build_object('mappa', x);
  end if;

  return out || jsonb_build_object('da', p_da, 'a', p_a);
end $$;

revoke all on function public.cruscotto_direzione(date, date) from public, anon;
grant execute on function public.cruscotto_direzione(date, date) to authenticated;
