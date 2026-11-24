-- =====================================================================
-- 13) Copie di sicurezza AUTOMATICHE con data (OBO Hub, Progettazione LPS, Mappa carichi)
-- Da eseguire una volta nell'editor SQL di Supabase (si può rieseguire). Dopo pro.sql.
--  - ogni notte alle 02:17 (UTC) il database salva da solo una copia di tutti i dati con la data del giorno
--    (stesso contenuto del file "Copia di sicurezza": le password NON ci sono);
--  - si tengono le copie degli ultimi 31 giorni: le più vecchie si tolgono da sole (richiesta di Marco,
--    "salva solo 1 mese di backup"); nessun altro dato viene cancellato;
--  - in Amministrazione → Copia di sicurezza l'admin (con Authenticator) vede l'elenco per data, scarica una copia,
--    la salva nella cartella OBO Hub di OneDrive/SharePoint e ripristina un progetto LPS di quel giorno
--    come NUOVO progetto del suo proprietario (l'originale non viene toccato).
-- Le copie si scrivono e si leggono solo attraverso le funzioni qui sotto (RLS attiva, nessuna policy).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.copie_sicurezza (
  id bigserial PRIMARY KEY,
  giorno date NOT NULL UNIQUE,
  creata_il timestamptz NOT NULL DEFAULT now(),
  origine text NOT NULL DEFAULT 'automatica',
  dimensione integer NOT NULL DEFAULT 0,
  dati jsonb NOT NULL
);
ALTER TABLE public.copie_sicurezza ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.copie_sicurezza FROM anon, authenticated;

-- contenuto della copia (uguale a copia_sicurezza() di pro.sql, senza controlli: la usano solo le funzioni sotto)
CREATE OR REPLACE FUNCTION public.dati_copia_sicurezza()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'creata', now(), 'versione', 1,
    'progetti',          (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.progetti x),
    'progetti_archivio', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.progetti_archivio x),
    'librerie_lps',      (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.librerie_lps x),
    'profiles',          (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.profiles x),
    'accessi_profili',   (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.accessi_profili x),
    'richieste_accesso', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.richieste_accesso x),
    'registro_accessi',  (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.registro_accessi x),
    'registro_errori',   (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.errori_app x),
    'registro_uso',      (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.uso_app x),
    'impostazioni_admin',(SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.impostazioni_admin x WHERE x.chiave NOT ILIKE '%password%'),
    'mappa_persone',     (SELECT coalesce(jsonb_agg(to_jsonb(x) - 'personal_pw'), '[]') FROM public.app_people x),
    'mappa_progetti',    (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.app_projects x),
    'mappa_accessi',     (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.app_access x),
    'mappa_impostazioni',(SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.app_settings x WHERE x.key NOT ILIKE '%pw%' AND x.key NOT ILIKE '%password%')
  );
$$;
REVOKE ALL ON FUNCTION public.dati_copia_sicurezza() FROM public, anon, authenticated;

-- copia del giorno (una per giorno: rifatta nello stesso giorno sostituisce quella del giorno) + tiene 31 giorni
CREATE OR REPLACE FUNCTION public.crea_copia_automatica(p_origine text DEFAULT 'automatica')
RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE d jsonb; nuovo bigint;
BEGIN
  d := public.dati_copia_sicurezza();
  INSERT INTO public.copie_sicurezza(giorno, creata_il, origine, dimensione, dati)
    VALUES ((now() AT TIME ZONE 'Europe/Rome')::date, now(), p_origine, octet_length(d::text), d)
    ON CONFLICT (giorno) DO UPDATE SET creata_il = excluded.creata_il, origine = excluded.origine, dimensione = excluded.dimensione, dati = excluded.dati
    RETURNING id INTO nuovo;
  DELETE FROM public.copie_sicurezza WHERE giorno < (now() AT TIME ZONE 'Europe/Rome')::date - 31;
  INSERT INTO public.impostazioni_admin(chiave, valore) VALUES ('ultima_copia_sicurezza', now()::text)
    ON CONFLICT (chiave) DO UPDATE SET valore = excluded.valore;
  RETURN nuovo;
END; $$;
REVOKE ALL ON FUNCTION public.crea_copia_automatica(text) FROM public, anon, authenticated;

-- ---------------------------------------------------------------- funzioni per l'admin (con Authenticator)
CREATE OR REPLACE FUNCTION public.copie_admin_ok() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.e_admin() AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
REVOKE ALL ON FUNCTION public.copie_admin_ok() FROM public, anon;

CREATE OR REPLACE FUNCTION public.elenco_copie()
RETURNS TABLE (id bigint, giorno date, creata_il timestamptz, origine text, dimensione integer, progetti integer, progetti_mappa integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.copie_admin_ok() THEN RAISE EXCEPTION 'solo amministratori con Authenticator'; END IF;
  RETURN QUERY SELECT c.id, c.giorno, c.creata_il, c.origine, c.dimensione,
    jsonb_array_length(coalesce(c.dati -> 'progetti', '[]')), jsonb_array_length(coalesce(c.dati -> 'mappa_progetti', '[]'))
    FROM public.copie_sicurezza c ORDER BY c.giorno DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.scarica_copia(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.copie_admin_ok() THEN RAISE EXCEPTION 'solo amministratori con Authenticator'; END IF;
  RETURN (SELECT dati FROM public.copie_sicurezza WHERE id = p_id);
END; $$;

CREATE OR REPLACE FUNCTION public.crea_copia_ora()
RETURNS bigint LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.copie_admin_ok() THEN RAISE EXCEPTION 'solo amministratori con Authenticator'; END IF;
  RETURN public.crea_copia_automatica('a mano');
END; $$;

-- Ripristino di un progetto LPS com'era nella copia: diventa un NUOVO progetto dello stesso proprietario,
-- con il nome "… (ripristino del gg/mm/aaaa)". Il progetto attuale (se c'è ancora) non viene toccato.
CREATE OR REPLACE FUNCTION public.ripristina_progetto_da_copia(p_copia bigint, p_progetto uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; p jsonb; nuovo uuid;
BEGIN
  IF NOT public.copie_admin_ok() THEN RAISE EXCEPTION 'solo amministratori con Authenticator'; END IF;
  SELECT * INTO c FROM public.copie_sicurezza WHERE id = p_copia;
  IF c IS NULL THEN RAISE EXCEPTION 'copia non trovata'; END IF;
  SELECT x INTO p FROM jsonb_array_elements(coalesce(c.dati -> 'progetti', '[]')) x WHERE x ->> 'id' = p_progetto::text LIMIT 1;
  IF p IS NULL THEN SELECT x INTO p FROM jsonb_array_elements(coalesce(c.dati -> 'progetti_archivio', '[]')) x WHERE coalesce(x ->> 'progetto', x ->> 'id') = p_progetto::text LIMIT 1; END IF;
  IF p IS NULL THEN RAISE EXCEPTION 'progetto non presente in questa copia'; END IF;
  INSERT INTO public.progetti(utente, codice, nome, comune, data_creazione, data_modifica, dati)
    VALUES ((p ->> 'utente')::uuid, coalesce(p ->> 'codice', ''),
            left(coalesce(p ->> 'nome', 'Progetto') || ' (ripristino del ' || to_char(c.giorno, 'DD/MM/YYYY') || ')', 200),
            coalesce(p ->> 'comune', ''), now(), now(), coalesce(p -> 'dati', '{}'::jsonb))
    RETURNING id INTO nuovo;
  PERFORM public.registra_accesso('ripristino_progetto', jsonb_build_object('copia', c.giorno, 'progetto', p_progetto, 'nuovo', nuovo));
  RETURN nuovo;
END; $$;

GRANT EXECUTE ON FUNCTION public.elenco_copie(), public.scarica_copia(bigint), public.crea_copia_ora(), public.ripristina_progetto_da_copia(bigint, uuid), public.copie_admin_ok() TO authenticated;

-- ---------------------------------------------------------------- pianificazione notturna (pg_cron)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'copia-obo-hub';
  PERFORM cron.schedule('copia-obo-hub', '17 2 * * *', $c$SELECT public.crea_copia_automatica('automatica')$c$);
END $$;

-- prima copia subito, così l'elenco non è vuoto
SELECT public.crea_copia_automatica('prima copia');

-- Controllo: SELECT jobname, schedule FROM cron.job;  SELECT giorno, dimensione FROM public.copie_sicurezza ORDER BY giorno DESC;
