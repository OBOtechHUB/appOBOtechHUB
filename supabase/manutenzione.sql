-- Manutenzione delle app di OBO Hub (Admin → Manutenzione).
-- Lo stato sta in impostazioni_admin, chiave 'manutenzione' (JSON: {"app:lps": {"nome": "...", "nome_en": "...", "fino": "...", "nota": "..."}, "lps:rischio": {...}}),
-- che solo gli admin possono leggere e scrivere. Questa funzione lo rende leggibile a tutte le app,
-- anche prima dell'accesso, insieme a "admin" (vero se chi chiede è un admin attivo, che può entrare lo stesso).
-- Da eseguire una volta nell'editor SQL di Supabase. Non modifica né cancella dati.
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
