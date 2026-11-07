import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { SaettaFigura } from "@/components/Saetta";
import { useAvanzamentoProgetto } from "@/lib/avanzamentoProgetto";

const NASCOSTA = ["/assistente", "/auth", "/reset-password", "/privacy", "/termini", "/contatti"];

/** Fascia sotto la barra superiore: Saetta, avanzamento del progetto e dati mancanti, su ogni pagina. */
export function BarraAvanzamento() {
  const percorso = useRouterState({ select: (s) => s.location.pathname });
  const { prossimo, comp, mancanti } = useAvanzamentoProgetto();
  const [aperta, setAperta] = useState(false);
  useEffect(() => { setAperta(false); }, [percorso]);
  if (NASCOSTA.some((p) => percorso.endsWith(p))) return null;

  return <div className="border-b bg-background">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
      <Link to="/assistente" aria-label="Apri l'assistente di progetto" className="shrink-0"><SaettaFigura className="h-10 w-8" /></Link>
      <div className="min-w-[160px] flex-1 sm:max-w-[220px]">
        <div className="flex justify-between text-xs"><span className="font-semibold">Progetto</span><span>{comp.percento}%</span></div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Avanzamento del progetto" aria-valuemin={0} aria-valuemax={100} aria-valuenow={comp.percento}>
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${comp.percento}%` }} />
        </div>
      </div>
      <p className="min-w-0 flex-[2] truncate text-sm">
        {prossimo
          ? <>Prossimo passo: {prossimo.to ? <Link to={prossimo.to} className="font-semibold text-primary hover:underline">{prossimo.titolo}</Link> : <strong>{prossimo.titolo}</strong>} <span className="text-muted-foreground">· {prossimo.motivo}</span></>
          : <span className="font-semibold">Tutti i passi disponibili sono completi.</span>}
      </p>
      {mancanti.length > 0 && <button type="button" aria-expanded={aperta} onClick={() => setAperta((v) => !v)} className="inline-flex items-center gap-1 rounded-full border border-primary px-3 py-1 text-xs text-primary hover:bg-primary/10">
        Dati mancanti ({mancanti.length}) <ChevronDown className={`size-3.5 transition-transform ${aperta ? "rotate-180" : ""}`} />
      </button>}
    </div>
    {aperta && <div className="border-t bg-muted/50">
      <ul className="mx-auto max-w-5xl divide-y px-4">{mancanti.map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <span><strong>{m.titolo}</strong> <span className="text-muted-foreground">· {m.motivo}</span></span>
        {m.to && <Link to={m.to} className="text-xs font-semibold text-primary hover:underline">Completa →</Link>}
      </li>)}</ul>
    </div>}
  </div>;
}
