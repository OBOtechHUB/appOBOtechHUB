/** Barra in alto in tutta l'app quando è uscita una versione nuova di LPS.lsp / istruzioni rispetto a quella scaricata. */
import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { LSP_VERSIONE, ISTRUZIONI } from "@/calcoli/cad/versioni";
import { aggiornamentoDisponibile } from "@/lib/istruzioni";

export function AvvisoVersioneCAD() {
  const [nuova, setNuova] = useState(false), percorso = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => { const v = () => setNuova(aggiornamentoDisponibile()); v(); addEventListener("lps-pacchetto", v); return () => removeEventListener("lps-pacchetto", v); }, []);
  if (!nuova || /download-cad/.test(percorso) || percorso.replace(/\/+$/, "") === "") return null; // in Istruzioni e nella pagina iniziale c'è già il riquadro
  return <div role="alert" className="border-b border-[#f39b00] bg-[#fff6e5] px-4 py-2 text-sm text-[#5c3b00] dark:bg-transparent dark:text-inherit">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
      <span><b>Nuova versione disponibile:</b> LPS.lsp {LSP_VERSIONE} e istruzioni Rev. {ISTRUZIONI.revisione}. Aggiorna il programma in AutoCAD / ZWCAD.</span>
      <Link to="/download-cad" className="font-semibold underline">Scarica l'ultima versione</Link>
    </div>
  </div>;
}
