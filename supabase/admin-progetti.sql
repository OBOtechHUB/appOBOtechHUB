-- Progettazione LPS · L'AMMINISTRATORE VEDE TUTTI I PROGETTI + ARCHIVIO DEI PROGETTI ELIMINATI
-- Incollare tutto nello SQL Editor di Supabase e premere Run (dopo accessi.sql). Si può rieseguire.
--
-- • L'amministratore (attivo, entrato con Authenticator) può LEGGERE progetti e librerie di tutti.
--   Non può modificarli né cancellarli: modifica e cancellazione restano solo al proprietario.
-- • Quando un utente elimina un progetto, una copia completa finisce nell'archivio (visibile solo agli admin).
-- • Cambiare sezioni, ruolo o stato di un utente, o eliminare il suo account, non tocca i suoi progetti.

-- ===== Lettura per l'amministratore =====
CREATE OR REPLACE FUNCTION public.admin_abilitato() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.e_admin() AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;
GRANT EXECUTE ON FUNCTION public.admin_abilitato() TO authenticated;

DROP POLICY IF EXISTS "progetti_admin_lettura" ON public.progetti;
CREATE POLICY "progetti_admin_lettura" ON public.progetti FOR SELECT TO authenticated USING (public.admin_abilitato());
DROP POLICY IF EXISTS "librerie_admin_lettura" ON public.librerie_lps;
CREATE POLICY "librerie_admin_lettura" ON public.librerie_lps FOR SELECT TO authenticated USING (public.admin_abilitato());

-- ===== Archivio dei progetti eliminati =====
CREATE TABLE IF NOT EXISTS public.progetti_archivio (
  id uuid PRIMARY KEY,
  utente uuid,
  email text,
  codice text NOT NULL DEFAULT '',
  nome text NOT NULL DEFAULT '',
  comune text NOT NULL DEFAULT '',
  data_creazione timestamptz,
  data_modifica timestamptz,
  dati jsonb NOT NULL DEFAULT '{}'::jsonb,
  eliminato_il timestamptz NOT NULL DEFAULT now(),
  eliminato_da uuid
);
ALTER TABLE public.progetti_archivio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "archivio_admin" ON public.progetti_archivio;
CREATE POLICY "archivio_admin" ON public.progetti_archivio FOR SELECT TO authenticated USING (public.admin_abilitato());
GRANT SELECT ON public.progetti_archivio TO authenticated;
GRANT ALL ON public.progetti_archivio TO service_role;

CREATE OR REPLACE FUNCTION public.archivia_progetto() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.progetti_archivio (id, utente, email, codice, nome, comune, data_creazione, data_modifica, dati, eliminato_il, eliminato_da)
  VALUES (OLD.id, OLD.utente, (SELECT email FROM auth.users WHERE id = OLD.utente), OLD.codice, OLD.nome, OLD.comune, OLD.data_creazione, OLD.data_modifica, OLD.dati, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE SET dati = EXCLUDED.dati, nome = EXCLUDED.nome, data_modifica = EXCLUDED.data_modifica, eliminato_il = now(), eliminato_da = EXCLUDED.eliminato_da;
  RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS archivia_progetto ON public.progetti;
CREATE TRIGGER archivia_progetto BEFORE DELETE ON public.progetti FOR EACH ROW EXECUTE FUNCTION public.archivia_progetto();
