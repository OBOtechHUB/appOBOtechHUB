-- OBO Hub · numeri del pannello Admin (rieseguibile, non tocca i dati)
-- 1) chi ha collegato Microsoft Authenticator: letto direttamente dal database, senza passare dalla funzione gestione-accessi
CREATE OR REPLACE FUNCTION public.admin_con_authenticator() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT DISTINCT f.user_id FROM auth.mfa_factors f
  WHERE f.status::text = 'verified' AND f.factor_type::text = 'totp' AND public.admin_abilitato();
$$;
REVOKE ALL ON FUNCTION public.admin_con_authenticator() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_con_authenticator() TO authenticated;

-- 2) registro accessi: ogni utente può scrivere solo i propri accessi (permesso necessario per contarli)
GRANT EXECUTE ON FUNCTION public.registra_accesso(text, jsonb) TO authenticated;
GRANT SELECT ON public.registro_accessi TO authenticated;
