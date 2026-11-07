CREATE TABLE public.librerie_lps (utente uuid PRIMARY KEY DEFAULT auth.uid(), catalogo jsonb NOT NULL DEFAULT '[]'::jsonb, particolari jsonb NOT NULL DEFAULT '[]'::jsonb);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.librerie_lps TO authenticated;
GRANT ALL ON public.librerie_lps TO service_role;
ALTER TABLE public.librerie_lps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "librerie_personali" ON public.librerie_lps FOR ALL TO authenticated USING (utente=(select auth.uid())) WITH CHECK (utente=(select auth.uid()));