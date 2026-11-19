-- =====================================================================
-- OBO Hub · Scadenza della password ogni 90 giorni (valore modificabile dagli admin)
-- Si esegue una volta in Supabase → SQL Editor, DOPO accessi.sql. Si può rieseguire.
-- Aggiunge una colonna e delle funzioni: nessun dato viene cancellato.
-- Per chi ha già un account il conteggio parte da oggi: nessuno viene bloccato subito.
-- Alla scadenza, all'accesso successivo, OBO Hub e Progettazione LPS chiedono una nuova password
-- (stessa schermata del primo accesso); finché non la cambia l'utente non vede i dati (regole RLS).
-- =====================================================================

-- data dell'ultimo cambio password
ALTER TABLE public.accessi_profili ADD COLUMN IF NOT EXISTS password_cambiata_il timestamptz;
UPDATE public.accessi_profili SET password_cambiata_il = now() WHERE password_cambiata_il IS NULL;
ALTER TABLE public.accessi_profili ALTER COLUMN password_cambiata_il SET DEFAULT now();

-- giorni di validità: impostazioni_admin, chiave 'giorni_scadenza_password' (0 = nessuna scadenza)
INSERT INTO public.impostazioni_admin (chiave, valore) VALUES ('giorni_scadenza_password', '90') ON CONFLICT (chiave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.giorni_scadenza_password() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT CASE WHEN valore ~ '^\s*\d+\s*$' THEN trim(valore)::integer END FROM public.impostazioni_admin WHERE chiave = 'giorni_scadenza_password'), 90);
$$;

-- password scaduta per un profilo (data dell'ultimo cambio + giorni di validità)
CREATE OR REPLACE FUNCTION public.password_scaduta_il(cambiata timestamptz) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.giorni_scadenza_password() > 0 AND cambiata IS NOT NULL AND cambiata < now() - make_interval(days => public.giorni_scadenza_password());
$$;

-- per l'app: la password va cambiata (prima password o scaduta) e data di scadenza
CREATE OR REPLACE FUNCTION public.stato_password() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'da_cambiare', p.deve_cambiare_password OR public.password_scaduta_il(p.password_cambiata_il),
    'scaduta', public.password_scaduta_il(p.password_cambiata_il),
    'giorni', public.giorni_scadenza_password(),
    'scade_il', CASE WHEN public.giorni_scadenza_password() > 0 AND p.password_cambiata_il IS NOT NULL
                     THEN p.password_cambiata_il + make_interval(days => public.giorni_scadenza_password()) END)
  FROM public.accessi_profili p WHERE p.utente = auth.uid();
$$;

-- cambio password: azzera il conteggio
CREATE OR REPLACE FUNCTION public.password_cambiata() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.accessi_profili SET deve_cambiare_password = false, password_cambiata_il = now() WHERE utente = auth.uid();
$$;

-- utente abilitato: anche con la password non scaduta
CREATE OR REPLACE FUNCTION public.utente_abilitato() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.accessi_profili
                 WHERE utente = auth.uid() AND stato = 'attivo' AND NOT deve_cambiare_password
                   AND NOT public.password_scaduta_il(password_cambiata_il))
     AND coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$$;

GRANT EXECUTE ON FUNCTION public.giorni_scadenza_password(), public.password_scaduta_il(timestamptz), public.stato_password(), public.password_cambiata(), public.utente_abilitato() TO authenticated;
