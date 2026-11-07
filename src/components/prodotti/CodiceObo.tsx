import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, FileText } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { caricaCatalogoObo, trovaArticolo, type ProdottoObo, type VarianteObo } from "@/lib/catalogoObo";

/**
 * Codice articolo OBO cliccabile: apre sul codice stesso l'anteprima del prodotto dal catalogo
 * (foto, disegno 2D quotato, dati principali, scheda tecnica).
 */
export function CodiceObo({ codice, className = "" }: { codice: string | null | undefined; className?: string }) {
  const [aperto, setAperto] = useState(false);
  const [trovato, setTrovato] = useState<{ prodotto: ProdottoObo; variante: VarianteObo | null } | null | undefined>(undefined);
  useEffect(() => {
    if (!aperto || trovato !== undefined || !codice) return;
    void caricaCatalogoObo().then((c) => setTrovato(c ? trovaArticolo(c, codice) : null));
  }, [aperto, trovato, codice]);
  if (!codice) return <span className={`font-mono text-muted-foreground ${className}`}>Da definire</span>;
  if (!/^\d{7}$/.test(codice)) return <span className={`font-mono ${className}`}>{codice}</span>;
  const p = trovato?.prodotto, v = trovato?.variante;
  const scheda = v?.scheda ?? p?.scheda ?? null;
  const dati = p ? Object.entries(p.datiTecnici).slice(0, 6) : [];
  return <Popover open={aperto} onOpenChange={setAperto}>
    <PopoverTrigger asChild>
      <button type="button" className={`font-mono text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid ${className}`} aria-label={`Anteprima articolo ${codice}`}>{codice}</button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-[min(92vw,420px)] p-3">
      {trovato === undefined && <p className="text-sm text-muted-foreground">Caricamento…</p>}
      {trovato === null && <p className="text-sm">Articolo <span className="font-mono">{codice}</span> non presente nel catalogo OBO letto (protezione esterna, sovratensioni, terra).</p>}
      {p && <div className="space-y-2">
        <p className="font-medium leading-snug">{p.nome}{v?.tipo ? <span className="text-muted-foreground"> · {v.tipo}</span> : null}</p>
        <p className="text-xs text-muted-foreground">art. <span className="font-mono">{codice}</span></p>
        <div className="grid grid-cols-2 gap-2">
          {p.foto && <img src={p.foto} alt={p.nome} loading="lazy" referrerPolicy="no-referrer" className="h-32 w-full rounded border-[0.8px] border-bordo-scheda object-contain" />}
          {p.disegno2d && <img src={p.disegno2d} alt={`Disegno quotato ${p.nome}`} loading="lazy" referrerPolicy="no-referrer" className="h-32 w-full rounded border-[0.8px] border-bordo-scheda object-contain" />}
        </div>
        {dati.length > 0 && <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">{dati.map(([k, x]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{x}</dd></div>)}</dl>}
        <div className="flex flex-wrap gap-3 pt-1 text-xs">
          {scheda && <a href={scheda} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><FileText className="size-3.5" />Scheda PDF</a>}
          <Link to="/prodotti" search={{ codice }} className="text-primary hover:underline">Apri nel catalogo</Link>
          <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:underline"><ExternalLink className="size-3.5" />OBO</a>
        </div>
      </div>}
    </PopoverContent>
  </Popover>;
}
