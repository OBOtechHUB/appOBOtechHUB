import { useEffect } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PUBBLICHE, SEZIONE_PAGINA, percorsoApp, prendiRitorno, puoVedere, salvaRitorno, useAccesso } from "@/lib/accesso";
import { PanoramicaPage } from "@/pages/PanoramicaPage";
import { registraUso } from "@/lib/registro";
import { AccessoNonDisponibile, AttivaAuthenticator, CambiaPassword, VerificaAuthenticator } from "./PassiAccesso";

/** Decide cosa mostrare: panoramica pubblica, passi di accesso, pagina richiesta o "sezione non abilitata". */
export function ControlloAccesso() {
  const a = useAccesso();
  const p = percorsoApp(useRouterState({ select: (s) => s.location.pathname }));
  const pubblica = PUBBLICHE.includes(p);
  const legale = ["/privacy", "/termini", "/contatti"].includes(p);
  // arrivati da OBO Hub (?ritorno=/obo-hub/): a accesso completato si torna lì
  useEffect(() => { salvaRitorno(new URLSearchParams(window.location.search).get("ritorno")); }, []);
  useEffect(() => { if (a.stato === "abilitato") { const r = prendiRitorno(); if (r) window.location.assign(r); } }, [a.stato]);
  const sezPagina = SEZIONE_PAGINA[p];
  useEffect(() => { if (a.stato === "abilitato") registraUso("", !a.profilo?.visitatore); }, [a.stato, a.profilo?.visitatore]); // apertura dell'app
  // statistiche d'uso: la sezione della pagina (o "home"), solo per chi è entrato; gli admin non contano
  useEffect(() => { if (a.stato === "abilitato" && p !== "/admin") registraUso(sezPagina && sezPagina !== "admin" ? sezPagina : p === "/" ? "home" : p.slice(1).split("/")[0] ?? "", !a.profilo?.visitatore); }, [a.stato, p, sezPagina, a.profilo?.visitatore]);
  if (a.stato === "caricamento") return <main className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground" role="status">Caricamento…</main>;
  if (a.stato === "anonimo") return p !== "/" && pubblica ? <Outlet /> : <PanoramicaPage />;
  if (legale) return <Outlet />;
  if (a.stato === "non-approvato" || a.stato === "sospeso") return <AccessoNonDisponibile />;
  if (a.stato === "cambia-password") return <CambiaPassword />;
  if (a.stato === "attiva-authenticator") return <AttivaAuthenticator />;
  if (a.stato === "verifica-authenticator") return <VerificaAuthenticator />;
  const sezione = SEZIONE_PAGINA[p];
  if (sezione && !puoVedere(a, sezione)) return <main className="mx-auto max-w-lg px-4 py-16 text-center">
    <ShieldOff className="mx-auto size-12 text-primary" strokeWidth={1.25} />
    <h1 className="mt-4 text-2xl font-bold">Sezione non abilitata</h1>
    <p className="mt-2 text-sm text-muted-foreground">Il tuo accesso non comprende questa sezione. Chiedi all'amministratore di abilitarla.</p>
    <Button className="mt-6" asChild><Link to="/">Torna alla home</Link></Button>
  </main>;
  return <Outlet />;
}
