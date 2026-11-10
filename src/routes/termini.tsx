import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { paginaHead } from "@/lib/head";
import { URL_HUB } from "@/lib/accesso";

/** La pagina comune è in OBO Hub (condizioni.html): uguale per tutte le app. */
function Rimando() {
  useEffect(() => { window.location.replace(`${URL_HUB}condizioni.html`); }, []);
  return <main className="mx-auto max-w-lg px-4 py-16 text-center text-sm"><a className="font-semibold text-primary underline" href={`${URL_HUB}condizioni.html`}>Condizioni d'uso</a></main>;
}
export const Route = createFileRoute("/termini")({ head: () => paginaHead("Condizioni d'uso", "Condizioni d'uso di OBO Hub e delle sue app."), component: Rimando });
