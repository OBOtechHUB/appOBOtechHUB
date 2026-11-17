import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import base from "@/dati/particolari/particolari.json";
import { caricaCatalogoObo, cercaProdotti, type CatalogoObo } from "@/lib/catalogoObo";

const PAGINE: { titolo: string; to: string; parole: string }[] = [
  { titolo: "Assistente di progetto", to: "/assistente", parole: "passi guida prossimo" },
  { titolo: "Dati edificio", to: "/dati-edificio", parole: "dimensioni lpl densità fulmini comune" },
  { titolo: "Edificio 3D · captazione e terra", to: "/edificio-3d", parole: "sfera rotolante maglia aste proposta terra dispersore" },
  { titolo: "Calate e distanza di separazione", to: "/calate", parole: "calate kc ki km distanza sicurezza" },
  { titolo: "Scelta SPD", to: "/spd", parole: "sovratensioni scaricatori iimp up uc" },
  { titolo: "Analisi del rischio", to: "/rischio", parole: "rischio r1 perdite probabilità" },
  { titolo: "Resistenza di terra", to: "/resistenza-terra", parole: "picchetto wenner resistività" },
  { titolo: "Computo materiali", to: "/computo-materiali", parole: "distinta quantità excel relazione" },
  { titolo: "Particolari costruttivi", to: "/particolari", parole: "schede tbs dwg pdf" },
  { titolo: "Verifiche e dossier", to: "/verifiche", parole: "ispezione manutenzione checklist" },
  { titolo: "Prodotti OBO", to: "/prodotti", parole: "catalogo articoli novità" },
  { titolo: "Modelli 3D prodotti", to: "/modelli-3d", parole: "stp step dxf dwg" },
  { titolo: "Download CAD", to: "/download-cad", parole: "zwcad autocad lsp" },
  { titolo: "I miei progetti", to: "/progetti", parole: "salvati apri" },
];
const particolari = base as unknown as { id: string; nome: string; componenti: { codiceOBO: string | null }[] }[];

/** Ricerca unica su pagine, particolari costruttivi e prodotti OBO. */
export function RicercaGlobale({ aperta, onChiudi }: { aperta: boolean; onChiudi: () => void }) {
  const [testo, setTesto] = useState("");
  const [catalogo, setCatalogo] = useState<CatalogoObo | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (aperta) { void caricaCatalogoObo().then(setCatalogo); setTimeout(() => input.current?.focus(), 50); } }, [aperta]);
  const q = testo.trim().toLowerCase();
  const risultati = useMemo(() => {
    if (q.length < 2) return null;
    const parole = q.split(/\s+/);
    const ok = (t: string) => parole.every((w) => t.toLowerCase().includes(w));
    return {
      pagine: PAGINE.filter((p) => ok(`${p.titolo} ${p.parole}`)).slice(0, 5),
      particolari: particolari.filter((p) => ok(`${p.nome} ${p.id} ${p.componenti.map((c) => c.codiceOBO ?? "").join(" ")}`)).slice(0, 6),
      prodotti: catalogo ? cercaProdotti(catalogo, q, null).slice(0, 8) : [],
    };
  }, [q, catalogo]);
  const chiudi = () => { onChiudi(); };
  const vuoto = risultati && !risultati.pagine.length && !risultati.particolari.length && !risultati.prodotti.length;

  return <Dialog open={aperta} onOpenChange={(o) => { if (!o) chiudi(); }}>
    <DialogContent aria-describedby={undefined} className="top-[12vh] max-h-[80dvh] w-[calc(100vw-2rem)] max-w-2xl translate-y-0 overflow-y-auto p-4 sm:p-6">
      <DialogHeader><DialogTitle>Cerca</DialogTitle></DialogHeader>
      <label className="flex items-center gap-2 rounded-full border border-primary px-4 py-2">
        <Search className="size-5 text-primary" strokeWidth={1.5} />
        <input ref={input} aria-label="Cerca" className="w-full bg-transparent text-base outline-none" placeholder="Pagina, particolare, prodotto o codice (es. isFang, T5.04, 5402864, SPD)" value={testo} onChange={(e) => setTesto(e.target.value)} />
      </label>
      {!risultati && <p className="text-sm text-muted-foreground">Scrivi almeno 2 caratteri.</p>}
      {vuoto && <p className="text-sm text-muted-foreground">Nessun risultato.</p>}
      {risultati && risultati.pagine.length > 0 && <section><h3 className="text-xs font-bold uppercase text-muted-foreground">Pagine</h3><ul className="mt-1">{risultati.pagine.map((p) => <li key={p.to}><Link to={p.to as "/"} onClick={chiudi} className="block rounded px-2 py-1.5 hover:bg-muted">{p.titolo}</Link></li>)}</ul></section>}
      {risultati && risultati.particolari.length > 0 && <section><h3 className="text-xs font-bold uppercase text-muted-foreground">Particolari costruttivi</h3><ul className="mt-1">{risultati.particolari.map((p) => <li key={p.id}><Link to="/particolari" search={{ rif: p.id }} onClick={chiudi} className="block rounded px-2 py-1.5 hover:bg-muted">{p.nome} <span className="font-mono text-xs text-muted-foreground">{p.id}</span></Link></li>)}</ul></section>}
      {risultati && risultati.prodotti.length > 0 && <section><h3 className="text-xs font-bold uppercase text-muted-foreground">Prodotti OBO</h3><ul className="mt-1">{risultati.prodotti.map((p) => <li key={p.url}><Link to="/prodotti" search={p.codice ? { codice: p.codice } : {}} onClick={chiudi} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-muted">{p.foto ? <img src={p.foto} alt="" loading="lazy" referrerPolicy="no-referrer" className="size-10 shrink-0 object-contain" /> : <span className="size-10 shrink-0 rounded bg-muted" />}<span className="min-w-0"><span className="block truncate">{p.nome}</span><span className="font-mono text-xs text-muted-foreground">{p.codice}</span></span></Link></li>)}</ul></section>}
    </DialogContent>
  </Dialog>;
}
