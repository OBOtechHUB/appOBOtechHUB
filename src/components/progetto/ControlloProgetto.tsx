/** Controllo "progetto completo": elenco di cosa manca o non torna, con il link alla pagina da sistemare. */
import { Link } from "@tanstack/react-router";
import type { VoceControllo } from "@/calcoli/progetto/controllo";

const SEGNO = { errore: "✕", avviso: "!", ok: "✓" } as const;
const COLORE = { errore: "bg-destructive text-destructive-foreground", avviso: "bg-accent text-accent-foreground", ok: "bg-secondary text-foreground" } as const;

export function ControlloProgetto({ voci }: { voci: VoceControllo[] }) {
  const err = voci.filter((v) => v.livello === "errore").length, avv = voci.filter((v) => v.livello === "avviso").length;
  const ordinate = voci.slice().sort((a, b) => ["errore", "avviso", "ok"].indexOf(a.livello) - ["errore", "avviso", "ok"].indexOf(b.livello));
  return <section className="mt-6 rounded-lg border p-4" aria-labelledby="h-controllo">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="h-controllo" className="font-display text-lg font-semibold">Controllo del progetto</h2>
      <span className="text-sm text-muted-foreground">{err || avv ? `${err} da sistemare · ${avv} da verificare` : "Tutto a posto: il progetto si può emettere"}</span>
    </div>
    <ul className="mt-3 divide-y">
      {ordinate.map((v) => <li key={v.id} className="flex items-start gap-3 py-2 text-sm">
        <span aria-hidden="true" className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${COLORE[v.livello]}`}>{SEGNO[v.livello]}</span>
        <span className="min-w-0 flex-1"><span className="font-semibold">{v.titolo}</span><span className="sr-only"> ({v.livello})</span><span className="block text-muted-foreground">{v.dettaglio}</span></span>
        {v.livello !== "ok" && <Link to={v.pagina as "/"} className="shrink-0 text-accent underline-offset-2 hover:underline">Sistema</Link>}
      </li>)}
    </ul>
    <p className="mt-2 text-xs text-muted-foreground">Finché ci sono punti aperti il progetto si può emettere solo confermando, e la relazione riporta la scritta "bozza".</p>
  </section>;
}
