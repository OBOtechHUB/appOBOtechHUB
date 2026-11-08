-- Progettazione LPS · CONTROLLO ACCESSI (amministratore, richieste, sezioni, registro, MFA)
-- Incollare tutto nello SQL Editor di Supabase e premere Run (una sola volta).
-- Prima: Authentication → Users → Add user → la tua email da amministratore con una password (≥ 6 caratteri).

-- ===== Tabelle =====
CREATE TABLE IF NOT EXISTS public.accessi_profili (
  utente uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  nome text NOT NULL DEFAULT '',
  azienda text NOT NULL DEFAULT '',
  ruolo text NOT NULL DEFAULT 'utente' CHECK (ruolo IN ('utente', 'admin')),
  stato text NOT NULL DEFAULT 'attivo' CHECK (stato IN ('attivo', 'sospeso')),
  sezioni text[] NOT NULL DEFAULT '{}',
  deve_cambiare_password boolean NOT NULL DEFAULT true,
  creato_il timestamptz NOT NULL DEFAULT now(),
  ultimo_accesso timestamptz
);

CREATE TABLE IF NOT EXISTS public.richieste_accesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  nome text NOT NULL DEFAULT '',
  azienda text NOT NULL DEFAULT '',
  motivo text NOT NULL DEFAULT '',
  stato text NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'approvata', 'rifiutata')),
  sezioni text[] NOT NULL DEFAULT '{}',
  creata_il timestamptz NOT NULL DEFAULT now(),
  gestita_il timestamptz,
  gestita_da uuid
);

CREATE TABLE IF NOT EXISTS public.registro_accessi (
  id bigserial PRIMARY KEY,
  utente uuid,
  email text,
  evento text NOT NULL,
  quando timestamptz NOT NULL DEFAULT now(),
  dettagli jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS registro_accessi_quando ON public.registro_accessi(quando DESC);

CREATE TABLE IF NOT EXISTS public.impostazioni_admin (
  chiave text PRIMARY KEY,
  valore text NOT NULL DEFAULT ''
);

-- ===== Funzioni di controllo =====
-- admin attivo (le funzioni SECURITY DEFINER evitano ricorsioni con le regole RLS)
CREATE OR REPLACE FUNCTION public.e_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.accessi_profili WHERE utente = auth.uid() AND ruolo = 'admin' AND stato = 'attivo');
$$;

-- utente approvato, attivo, con password già cambiata e accesso confermato con l'app Authenticator (aal2)
CREATE OR REPLACE FUNCTION public.utente_abilitato() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.accessi_profili WHERE utente = auth.uid() AND stato = 'attivo' AND NOT deve_cambiare_password)
     AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

-- l'utente segna di aver cambiato la password iniziale
CREATE OR REPLACE FUNCTION public.password_cambiata() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.accessi_profili SET deve_cambiare_password = false WHERE utente = auth.uid();
$$;

-- registro di accesso (solo per sé stessi)
CREATE OR REPLACE FUNCTION public.registra_accesso(evento text, dettagli jsonb DEFAULT '{}'::jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR evento NOT IN ('accesso', 'uscita', 'password_cambiata', 'authenticator_attivato', 'accesso_negato') THEN RETURN; END IF;
  INSERT INTO public.registro_accessi(utente, email, evento, dettagli) VALUES (auth.uid(), auth.jwt() ->> 'email', evento, coalesce(dettagli, '{}'::jsonb));
  IF evento = 'accesso' THEN UPDATE public.accessi_profili SET ultimo_accesso = now() WHERE utente = auth.uid(); END IF;
END; $$;

GRANT EXECUTE ON FUNCTION public.e_admin(), public.utente_abilitato(), public.password_cambiata(), public.registra_accesso(text, jsonb) TO authenticated;

-- ===== Regole di sicurezza (RLS) =====
ALTER TABLE public.accessi_profili ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.richieste_accesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registro_accessi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impostazioni_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profilo_letto" ON public.accessi_profili;
CREATE POLICY "profilo_letto" ON public.accessi_profili FOR SELECT TO authenticated USING (utente = auth.uid() OR public.e_admin());
DROP POLICY IF EXISTS "profili_admin" ON public.accessi_profili;
CREATE POLICY "profili_admin" ON public.accessi_profili FOR UPDATE TO authenticated USING (public.e_admin()) WITH CHECK (public.e_admin());

DROP POLICY IF EXISTS "richieste_admin" ON public.richieste_accesso;
CREATE POLICY "richieste_admin" ON public.richieste_accesso FOR ALL TO authenticated USING (public.e_admin()) WITH CHECK (public.e_admin());

DROP POLICY IF EXISTS "registro_admin" ON public.registro_accessi;
CREATE POLICY "registro_admin" ON public.registro_accessi FOR SELECT TO authenticated USING (public.e_admin());

DROP POLICY IF EXISTS "impostazioni_admin" ON public.impostazioni_admin;
CREATE POLICY "impostazioni_admin" ON public.impostazioni_admin FOR ALL TO authenticated USING (public.e_admin()) WITH CHECK (public.e_admin());

GRANT SELECT, UPDATE ON public.accessi_profili TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.richieste_accesso TO authenticated;
GRANT SELECT ON public.registro_accessi TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.impostazioni_admin TO authenticated;
-- le funzioni Edge (gestione-accessi, richiesta-accesso) lavorano con il ruolo service_role
GRANT ALL ON public.accessi_profili, public.richieste_accesso, public.registro_accessi, public.impostazioni_admin TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- I dati dei progetti e delle librerie sono accessibili solo a utenti abilitati (approvati + Authenticator)
DROP POLICY IF EXISTS "progetti_propri" ON public.progetti;
CREATE POLICY "progetti_propri" ON public.progetti FOR ALL TO authenticated
  USING (utente = (select auth.uid()) AND public.utente_abilitato()) WITH CHECK (utente = (select auth.uid()) AND public.utente_abilitato());
DROP POLICY IF EXISTS "librerie_personali" ON public.librerie_lps;
CREATE POLICY "librerie_personali" ON public.librerie_lps FOR ALL TO authenticated
  USING (utente = (select auth.uid()) AND public.utente_abilitato()) WITH CHECK (utente = (select auth.uid()) AND public.utente_abilitato());
DROP POLICY IF EXISTS "particolari_lettura_utenti" ON storage.objects;
CREATE POLICY "particolari_lettura_utenti" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'particolari' AND public.utente_abilitato());

-- ===== Primo amministratore =====
-- Sostituisci l'email se diversa, poi esegui (l'utente deve già esistere in Authentication → Users).
INSERT INTO public.accessi_profili (utente, email, nome, ruolo, stato, sezioni, deve_cambiare_password)
SELECT id, email, 'Amministratore', 'admin', 'attivo', ARRAY['tutte'], true FROM auth.users WHERE lower(email) = lower('lovetere.marco@obo.it')
ON CONFLICT (utente) DO UPDATE SET ruolo = 'admin', stato = 'attivo', sezioni = ARRAY['tutte'];

INSERT INTO public.impostazioni_admin (chiave, valore) VALUES
  ('email_admin', 'lovetere.marco@obo.it'),
  ('password_iniziale', ''),
  ('sezioni_predefinite', 'assistente,edificio,rischio,captazione,calate,terra,spd,computo,particolari,prodotti')
ON CONFLICT (chiave) DO NOTHING;
