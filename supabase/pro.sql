-- OBO Hub "pro": registro errori, statistiche d'uso, copia di sicurezza, manutenzione.
-- Da eseguire una volta nell'editor SQL di Supabase (si può rieseguire senza problemi).
-- Non modifica né cancella dati esistenti: crea solo tabelle nuove e funzioni.
-- I registri (accessi, errori, uso) non vengono MAI cancellati: né dalle app né in automatico.

-- ===================================================================== 1) Registro errori
-- Le app mandano qui gli errori del browser (pagina, messaggio, browser). Solo gli admin li leggono.
CREATE TABLE IF NOT EXISTS public.errori_app (
  id        bigserial PRIMARY KEY,
  quando    timestamptz NOT NULL DEFAULT now(),
  app       text NOT NULL,
  pagina    text NOT NULL DEFAULT '',
  messaggio text NOT NULL,
  dettagli  text NOT NULL DEFAULT '',
  browser   text NOT NULL DEFAULT '',
  versione  text NOT NULL DEFAULT '',
  utente    uuid,
  volte     int  NOT NULL DEFAULT 1,
  risolto   timestamptz
);
ALTER TABLE public.errori_app ADD COLUMN IF NOT EXISTS risolto timestamptz;
CREATE INDEX IF NOT EXISTS errori_app_quando ON public.errori_app(quando DESC);
ALTER TABLE public.errori_app ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "errori_admin_lettura" ON public.errori_app;
CREATE POLICY "errori_admin_lettura" ON public.errori_app FOR SELECT TO authenticated USING (public.e_admin());
-- "Risolto" segna l'errore (data), non lo cancella: nessuno può cancellare righe del registro
DROP POLICY IF EXISTS "errori_admin_cancella" ON public.errori_app;
DROP POLICY IF EXISTS "errori_admin_risolto" ON public.errori_app;
CREATE POLICY "errori_admin_risolto" ON public.errori_app FOR UPDATE TO authenticated USING (public.e_admin()) WITH CHECK (public.e_admin());
REVOKE ALL ON public.errori_app FROM anon, authenticated;
GRANT SELECT ON public.errori_app TO authenticated;
GRANT UPDATE (risolto) ON public.errori_app TO authenticated;

-- Le app scrivono solo con questa funzione: testi accorciati, lo stesso errore nella stessa ora
-- conta "volte" invece di fare righe nuove, al massimo 300 errori diversi all'ora. Non si cancella niente.
CREATE OR REPLACE FUNCTION public.segnala_errore(app text, pagina text, messaggio text, dettagli text DEFAULT '', browser text DEFAULT '', versione text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m text := left(coalesce(messaggio, ''), 500); p text := left(coalesce(pagina, ''), 300); a text := left(coalesce(app, ''), 40);
BEGIN
  IF m = '' OR a = '' THEN RETURN; END IF;
  UPDATE public.errori_app SET volte = volte + 1, quando = now()
   WHERE errori_app.app = a AND errori_app.pagina = p AND errori_app.messaggio = m AND errori_app.risolto IS NULL AND errori_app.quando > now() - interval '1 hour';
  IF FOUND THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.errori_app WHERE quando > now() - interval '1 hour') >= 300 THEN RETURN; END IF;
  INSERT INTO public.errori_app(app, pagina, messaggio, dettagli, browser, versione, utente)
  VALUES (a, p, m, left(coalesce(dettagli, ''), 4000), left(coalesce(browser, ''), 300), left(coalesce(versione, ''), 60), auth.uid());
END; $$;
REVOKE ALL ON FUNCTION public.segnala_errore(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.segnala_errore(text, text, text, text, text, text) TO anon, authenticated;

-- ===================================================================== 2) Statistiche d'uso
-- Un'apertura di app o sezione per persona ogni 30 minuti. Gli admin non contano.
CREATE TABLE IF NOT EXISTS public.uso_app (
  id         bigserial PRIMARY KEY,
  quando     timestamptz NOT NULL DEFAULT now(),
  app        text NOT NULL,
  sezione    text NOT NULL DEFAULT '',
  utente     uuid,
  visitatore text
);
CREATE INDEX IF NOT EXISTS uso_app_quando ON public.uso_app(quando DESC);
ALTER TABLE public.uso_app ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.uso_app FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.registra_uso(app text, sezione text DEFAULT '', visitatore text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a text := left(coalesce(app, ''), 40); s text := left(coalesce(sezione, ''), 60); v text := nullif(left(coalesce(visitatore, ''), 80), '');
BEGIN
  IF a = '' OR public.e_admin() THEN RETURN; END IF;
  IF auth.uid() IS NULL AND v IS NULL THEN RETURN; END IF; -- solo utenti entrati o visitatori
  IF EXISTS (SELECT 1 FROM public.uso_app u WHERE u.app = a AND u.sezione = s AND u.quando > now() - interval '30 minutes'
             AND ((auth.uid() IS NOT NULL AND u.utente = auth.uid()) OR (auth.uid() IS NULL AND u.visitatore = v))) THEN RETURN; END IF;
  INSERT INTO public.uso_app(app, sezione, utente, visitatore) VALUES (a, s, auth.uid(), CASE WHEN auth.uid() IS NULL THEN v END);
END; $$;
REVOKE ALL ON FUNCTION public.registra_uso(text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.registra_uso(text, text, text) TO anon, authenticated;

-- Per l'admin: aperture per giorno, app e sezione, con il numero di persone diverse.
CREATE OR REPLACE FUNCTION public.statistiche_uso(da timestamptz)
RETURNS TABLE(giorno date, app text, sezione text, aperture bigint, persone bigint, visitatori bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (u.quando AT TIME ZONE 'Europe/Rome')::date, u.app, u.sezione, count(*),
         count(DISTINCT u.utente), count(DISTINCT u.visitatore)
    FROM public.uso_app u
   WHERE public.e_admin() AND u.quando >= da
   GROUP BY 1, 2, 3
   ORDER BY 1, 2, 3;
$$;
REVOKE ALL ON FUNCTION public.statistiche_uso(timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.statistiche_uso(timestamptz) TO authenticated;

-- Per l'admin: registro d'uso completo, riga per riga (da scaricare in CSV).
CREATE OR REPLACE FUNCTION public.registro_uso_completo()
RETURNS TABLE(quando timestamptz, app text, sezione text, utente uuid, visitatore text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.quando, u.app, u.sezione, u.utente, u.visitatore FROM public.uso_app u WHERE public.e_admin() ORDER BY u.quando;
$$;
REVOKE ALL ON FUNCTION public.registro_uso_completo() FROM public;
GRANT EXECUTE ON FUNCTION public.registro_uso_completo() TO authenticated;

-- ===================================================================== 3) Copia di sicurezza
-- Tutti i dati di OBO Hub in un unico file, per l'admin con accesso confermato da Authenticator.
-- Le password (iniziale, visitatori, Mappa) NON sono incluse.
CREATE OR REPLACE FUNCTION public.copia_sicurezza()
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.e_admin() OR coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN RAISE EXCEPTION 'solo amministratori con Authenticator'; END IF;
  r := jsonb_build_object(
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
    -- Mappa carichi ufficio tecnico (senza password)
    'mappa_persone',     (SELECT coalesce(jsonb_agg(to_jsonb(x) - 'personal_pw'), '[]') FROM public.app_people x),
    'mappa_progetti',    (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.app_projects x),
    'mappa_accessi',     (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.app_access x),
    'mappa_impostazioni',(SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]') FROM public.app_settings x WHERE x.key NOT ILIKE '%pw%' AND x.key NOT ILIKE '%password%')
  );
  INSERT INTO public.impostazioni_admin(chiave, valore) VALUES ('ultima_copia_sicurezza', now()::text)
    ON CONFLICT (chiave) DO UPDATE SET valore = excluded.valore;
  RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.copia_sicurezza() FROM public;
GRANT EXECUTE ON FUNCTION public.copia_sicurezza() TO authenticated;

-- ===================================================================== 4) Manutenzione (OBO Hub → Manutenzione app)
CREATE OR REPLACE FUNCTION public.stato_manutenzione() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'sezioni', coalesce((SELECT CASE WHEN valore ~ '^\s*\{' THEN valore::jsonb END FROM public.impostazioni_admin WHERE chiave = 'manutenzione'), '{}'::jsonb),
    'admin', public.e_admin(),
    'ricerca', (SELECT valore FROM public.impostazioni_admin WHERE chiave = 'ricerca')
  );
$$;
REVOKE ALL ON FUNCTION public.stato_manutenzione() FROM public;
GRANT EXECUTE ON FUNCTION public.stato_manutenzione() TO anon, authenticated;
