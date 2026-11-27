-- SQL 21 · Richieste di accesso alle app (27/11/2026)
-- Il personale OBO con un account vede tutte le app di OBO Hub: quelle non abilitate compaiono con una breve
-- presentazione e il pulsante «Richiedi l'accesso». La richiesta arriva all'amministratore in
-- Amministrazione → Richieste, che la approva (aggiunge l'app alle sezioni della persona) o la rifiuta.
-- Non si cancella nulla: le richieste restano con lo stato e la data. Si può rieseguire.
-- Da eseguire nello SQL Editor di Supabase (dopo accessi.sql). Controllo finale in fondo.

CREATE TABLE IF NOT EXISTS public.richieste_app (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utente uuid NOT NULL,
  email text NOT NULL DEFAULT '',
  nome text NOT NULL DEFAULT '',
  app text NOT NULL CHECK (app IN ('lps', 'mappa', 'prodotti', 'zavorra', 'torrette')),
  motivo text NOT NULL DEFAULT '',
  stato text NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'approvata', 'rifiutata')),
  creata_il timestamptz NOT NULL DEFAULT now(),
  gestita_il timestamptz,
  gestita_da uuid
);
-- quando la funzione richiesta-accesso ha mandato l'email all'amministratore (una sola volta per richiesta)
ALTER TABLE public.richieste_app ADD COLUMN IF NOT EXISTS avvisata_il timestamptz;
CREATE INDEX IF NOT EXISTS richieste_app_utente ON public.richieste_app(utente, app, stato);

ALTER TABLE public.richieste_app ENABLE ROW LEVEL SECURITY;
-- ognuno legge le proprie richieste; l'amministratore le legge tutte e le gestisce (stato), mai cancellate
DROP POLICY IF EXISTS "richieste_app_proprie" ON public.richieste_app;
CREATE POLICY "richieste_app_proprie" ON public.richieste_app FOR SELECT TO authenticated USING (utente = auth.uid() OR public.e_admin());
DROP POLICY IF EXISTS "richieste_app_admin" ON public.richieste_app;
CREATE POLICY "richieste_app_admin" ON public.richieste_app FOR UPDATE TO authenticated USING (public.e_admin()) WITH CHECK (public.e_admin());
REVOKE ALL ON public.richieste_app FROM anon;
REVOKE INSERT, DELETE, TRUNCATE ON public.richieste_app FROM authenticated;
GRANT SELECT, UPDATE ON public.richieste_app TO authenticated;
GRANT ALL ON public.richieste_app TO service_role;

-- la richiesta si crea solo da qui: persona con account attivo, una sola richiesta in attesa per app, massimo 10 al giorno
CREATE OR REPLACE FUNCTION public.richiedi_app(p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  io public.accessi_profili;
  a text := lower(coalesce(p->>'app', ''));
  m text := left(coalesce(p->>'motivo', ''), 1000);
  gia public.richieste_app;
  nuova uuid;
BEGIN
  SELECT * INTO io FROM public.accessi_profili WHERE utente = auth.uid() AND stato = 'attivo';
  IF NOT FOUND THEN RETURN jsonb_build_object('errore', 'Account non attivo.'); END IF;
  IF a NOT IN ('lps', 'mappa', 'prodotti', 'zavorra', 'torrette') THEN RETURN jsonb_build_object('errore', 'App sconosciuta.'); END IF;
  SELECT * INTO gia FROM public.richieste_app WHERE utente = io.utente AND app = a AND stato = 'in_attesa' ORDER BY creata_il DESC LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('id', gia.id, 'gia', true, 'creata_il', gia.creata_il); END IF;
  IF (SELECT count(*) FROM public.richieste_app WHERE utente = io.utente AND creata_il > now() - interval '1 day') >= 10 THEN
    RETURN jsonb_build_object('errore', 'Troppe richieste oggi: riprova domani.');
  END IF;
  INSERT INTO public.richieste_app (utente, email, nome, app, motivo) VALUES (io.utente, io.email, io.nome, a, m) RETURNING id INTO nuova;
  INSERT INTO public.registro_accessi (utente, email, evento, dettagli) VALUES (io.utente, io.email, 'richiesta_app', jsonb_build_object('app', a));
  RETURN jsonb_build_object('id', nuova, 'gia', false);
END $$;
REVOKE ALL ON FUNCTION public.richiedi_app(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.richiedi_app(jsonb) TO authenticated;

-- controllo finale: deve restituire una riga con tutti "ok"
SELECT
  CASE WHEN to_regclass('public.richieste_app') IS NOT NULL THEN 'ok' ELSE 'MANCA' END AS tabella,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'richiedi_app') THEN 'ok' ELSE 'MANCA' END AS funzione,
  CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.richieste_app'::regclass) THEN 'ok' ELSE 'MANCA' END AS rls,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'richieste_app' AND column_name = 'avvisata_il') THEN 'ok' ELSE 'MANCA' END AS email;
