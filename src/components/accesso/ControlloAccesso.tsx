import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PUBBLICHE, SEZIONE_PAGINA, percorsoApp, puoVedere, useAccesso } from "@/lib/accesso";
import { PanoramicaPage } from "@/pages/PanoramicaPage";
import { AccessoNonDisponibile, AttivaAuthenticator, CambiaPassword, VerificaAuthenticator } from "./PassiAccesso";

/** Decide cosa mostrare: panoramica pubblica, passi di accesso, pagina richiesta o "sezione non abilitata". */
export function ControlloAccesso() {
  const a = useAccesso();
  const p = percorsoApp(useRouterState({ select: (s) => s.location.pathname }));
  const pubblica = PUBBLICHE.includes(p);
  const legale = ["/privacy", "/termini", "/contatti"].includes(p);
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
