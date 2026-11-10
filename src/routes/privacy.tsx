import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { paginaHead } from "@/lib/head";
import { URL_HUB } from "@/lib/accesso";

/** La pagina comune è in OBO Hub (privacy.html): uguale per tutte le app. */
function Rimando() {
  useEffect(() => { window.location.replace(`${URL_HUB}privacy.html`); }, []);
  return <main className="mx-auto max-w-lg px-4 py-16 text-center text-sm"><a className="font-semibold text-primary underline" href={`${URL_HUB}privacy.html`}>Privacy</a></main>;
}
export const Route = createFileRoute("/privacy")({ head: () => paginaHead("Privacy", "Privacy di OBO Hub e delle sue app."), component: Rimando });
