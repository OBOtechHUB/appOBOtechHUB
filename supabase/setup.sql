-- Progettazione LPS: configurazione completa del database Supabase.
-- Incollare tutto nello SQL Editor di Supabase e premere Run (una sola volta).

-- ===== 0000_portale_progetti_profili.sql =====
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, nome_visualizzato text NOT NULL DEFAULT '', avatar_url text, preferenze jsonb NOT NULL DEFAULT '{}'::jsonb);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profilo_proprio" ON public.profiles FOR ALL TO authenticated USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));
CREATE FUNCTION public.crea_profilo_lps() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.profiles(id,nome_visualizzato) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome_visualizzato',NEW.raw_user_meta_data->>'full_name','')); RETURN NEW; END; $$;
CREATE TRIGGER crea_profilo_lps AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.crea_profilo_lps();
CREATE TABLE public.progetti (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), utente uuid NOT NULL DEFAULT auth.uid(), codice text NOT NULL DEFAULT '', nome text NOT NULL DEFAULT 'Nuovo progetto', comune text NOT NULL DEFAULT '', data_creazione timestamptz NOT NULL DEFAULT now(), data_modifica timestamptz NOT NULL DEFAULT now(), dati jsonb NOT NULL DEFAULT '{}'::jsonb);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progetti TO authenticated;
GRANT ALL ON public.progetti TO service_role;
ALTER TABLE public.progetti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progetti_propri" ON public.progetti FOR ALL TO authenticated USING (utente = (select auth.uid())) WITH CHECK (utente = (select auth.uid()));
CREATE INDEX progetti_utente_modifica ON public.progetti(utente,data_modifica DESC);
CREATE FUNCTION public.modifica_progetto_lps() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.data_modifica = now(); NEW.utente = OLD.utente; RETURN NEW; END; $$;
CREATE TRIGGER modifica_progetto_lps BEFORE UPDATE ON public.progetti FOR EACH ROW EXECUTE FUNCTION public.modifica_progetto_lps();

-- ===== 0001_libreria_personale_lps.sql =====
CREATE TABLE public.librerie_lps (utente uuid PRIMARY KEY DEFAULT auth.uid(), catalogo jsonb NOT NULL DEFAULT '[]'::jsonb, particolari jsonb NOT NULL DEFAULT '[]'::jsonb);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.librerie_lps TO authenticated;
GRANT ALL ON public.librerie_lps TO service_role;
ALTER TABLE public.librerie_lps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "librerie_personali" ON public.librerie_lps FOR ALL TO authenticated USING (utente=(select auth.uid())) WITH CHECK (utente=(select auth.uid()));

-- ===== 0002_librerie_lps_parametri.sql =====
ALTER TABLE public.librerie_lps ADD COLUMN IF NOT EXISTS parametri jsonb;
COMMENT ON COLUMN public.librerie_lps.parametri IS 'Parametri normativi personali (es. pendenzaMassimaMaglia per il metodo della maglia, CEI EN IEC 62305-3:2024).';

-- ===== 0003_particolari_verificati.sql =====
ALTER TABLE public.librerie_lps ADD COLUMN IF NOT EXISTS particolari_verificati text[] NOT NULL DEFAULT '{}';

-- ===== Archivio privato delle schede PDF dei particolari =====
INSERT INTO storage.buckets (id, name, public) VALUES ('particolari', 'particolari', false)
ON CONFLICT (id) DO NOTHING;

-- lettura consentita solo agli utenti collegati; il caricamento si fa dal pannello Supabase
DROP POLICY IF EXISTS "particolari_lettura_utenti" ON storage.objects;
CREATE POLICY "particolari_lettura_utenti" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'particolari');

-- ===== Permessi per l'API (necessari se "Automatically expose new tables" è disattivato) =====
-- L'accesso alle righe resta limitato dalle regole RLS definite sopra.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progetti, public.librerie_lps, public.profiles TO authenticated;
