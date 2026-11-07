import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Box, Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { inputCls } from "@/components/Campo";
import { NOMI_CATEGORIE, cercaProdotti, nomeSottocategoria, useCatalogoObo, type ProdottoObo } from "@/lib/catalogoObo";

const PAGINA = 48;

function Immagine({ src, alt, className }: { src: string | null; alt: string; className?: string }) {
  const [errore, setErrore] = useState(false);
  if (!src || errore) return <div className={`flex items-center justify-center bg-muted text-xs text-muted-foreground ${className ?? ""}`}>Nessuna immagine</div>;
  return <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setErrore(true)} className={`object-contain ${className ?? ""}`} />;
}

function Dettaglio({ p, onClose }: { p: ProdottoObo; onClose: () => void }) {
  const colonne = p.varianti.find((v) => v.colonne)?.colonne;
  return <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent aria-describedby={undefined} className="max-h-[95dvh] w-[calc(100vw-2rem)] max-w-5xl overflow-y-auto p-4 sm:p-6">
      <DialogHeader><DialogTitle className="pr-8 leading-snug">{p.nome}</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">{NOMI_CATEGORIE[p.categorie[0] ?? ""] ?? ""}{p.categorie.slice(1).map((c) => ` › ${nomeSottocategoria(c)}`).join("")} · art. <span className="font-mono">{p.codice}</span></p>
      <div className="grid gap-4 sm:grid-cols-2">
        <figure className="rounded-lg border-[0.8px] border-bordo-scheda p-2"><Immagine src={p.foto} alt={p.nome} className="h-64 w-full" /><figcaption className="mt-1 text-center text-xs text-muted-foreground">Foto prodotto</figcaption></figure>
        <figure className="rounded-lg border-[0.8px] border-bordo-scheda p-2"><Immagine src={p.disegno2d} alt={`Disegno quotato ${p.nome}`} className="h-64 w-full" /><figcaption className="mt-1 text-center text-xs text-muted-foreground">Disegno 2D quotato</figcaption></figure>
      </div>
      <div className="flex flex-wrap gap-2">
        {p.scheda && <Button variant="outline" asChild><a href={p.scheda} target="_blank" rel="noopener noreferrer"><FileText />Scheda tecnica PDF</a></Button>}
        {p.file3d.stp && <Button variant="outline" asChild><a href={p.file3d.stp} target="_blank" rel="noopener noreferrer"><Download />Modello 3D (STP)</a></Button>}
        {p.file3d.rfa && <Button variant="outline" asChild><a href={p.file3d.rfa} target="_blank" rel="noopener noreferrer"><Download />Famiglia Revit (RFA)</a></Button>}
        {p.file3d.cad.map((u) => <Button key={u} variant="outline" asChild><a href={u} target="_blank" rel="noopener noreferrer"><Download />{u.split(".").pop()?.toUpperCase()}</a></Button>)}
        <Button variant="link" asChild><a href={p.url} target="_blank" rel="noopener noreferrer"><ExternalLink />Pagina OBO</a></Button>
      </div>
      {p.file3d.stp && <p className="text-xs text-muted-foreground">Per vedere il 3D e convertirlo in DXF/DWG: scarica lo STP e aprilo in <Link to="/modelli-3d" className="text-primary underline">Modelli 3D prodotti</Link>.</p>}
      {Object.keys(p.datiTecnici).length > 0 && <section><h3 className="font-semibold">Dati tecnici</h3>
        <div className="mt-2 overflow-x-auto"><table className="w-full text-sm"><tbody>{Object.entries(p.datiTecnici).map(([k, v]) => <tr key={k} className="border-b"><th className="w-1/2 p-2 text-left font-normal text-muted-foreground">{k}</th><td className="p-2">{v}</td></tr>)}</tbody></table></div>
      </section>}
      {p.varianti.length > 0 && <section><h3 className="font-semibold">Varianti ({p.varianti.length})</h3>
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[520px] text-sm">
          {colonne && <thead><tr className="border-b text-left">{colonne.map((c, i) => <th key={i} className="p-2">{c}</th>)}<th className="p-2" /></tr></thead>}
          <tbody>{p.varianti.map((v) => <tr key={v.codice} className="border-b"><td className="p-2 font-mono">{v.codice}</td>{v.valori.map((x, i) => <td key={i} className="p-2">{x}</td>)}<td className="p-2 text-right">{v.scheda && <a href={v.scheda} target="_blank" rel="noopener noreferrer" className="text-primary underline">PDF</a>}</td></tr>)}</tbody>
        </table></div>
      </section>}
      <p className="text-xs text-muted-foreground">Dati, immagini e documenti da obo-bettermann.com: fa fede sempre la pagina ufficiale del prodotto.</p>
    </DialogContent>
  </Dialog>;
}

export function ProdottiPage() {
  const { catalogo, pronto } = useCatalogoObo();
  const [testo, setTesto] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [limite, setLimite] = useState(PAGINA);
  const [aperto, setAperto] = useState<ProdottoObo | null>(null);
  const risultati = useMemo(() => (catalogo ? cercaProdotti(catalogo, testo, categoria) : []), [catalogo, testo, categoria]);

  return <>
    <section className="bg-ardesia text-white"><div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Prodotti OBO</h1>
      <p className="mt-2 max-w-3xl text-white/90">Protezione esterna contro i fulmini, protezione dalle sovratensioni, equipotenzialità e messa a terra: dati tecnici, varianti, foto, disegni 2D, schede tecniche e file 3D.</p>
      {catalogo && <p className="mt-2 text-sm text-white/70">{catalogo.prodotti} prodotti · {catalogo.articoli} articoli · aggiornato il {new Date(catalogo.aggiornato).toLocaleDateString("it-IT")}</p>}
    </div></section>
    <main className="mx-auto max-w-5xl px-4 py-8">
      {!pronto && <p role="status" className="text-sm text-muted-foreground">Caricamento del catalogo…</p>}
      {pronto && !catalogo && <p role="status" className="rounded-lg border-l-4 border-primary bg-muted p-4 text-sm">Il catalogo non è ancora stato generato: viene creato automaticamente dal lettore del sito OBO (GitHub Actions) e compare qui al termine.</p>}
      {catalogo && <>
        <div className="flex flex-wrap gap-3">
          <input aria-label="Cerca" className={`${inputCls} max-w-md`} placeholder="Cerca per nome, codice articolo o tipo (es. isFang, 5402864, V20)" value={testo} onChange={(e) => { setTesto(e.target.value); setLimite(PAGINA); }} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Categoria">
            <Button size="sm" variant={categoria === null ? "default" : "outline"} onClick={() => setCategoria(null)}>Tutte</Button>
            {catalogo.categorie.map((c) => <Button key={c} size="sm" variant={categoria === c ? "default" : "outline"} onClick={() => { setCategoria(c); setLimite(PAGINA); }}>{NOMI_CATEGORIE[c] ?? c}</Button>)}
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{risultati.length} prodotti</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{risultati.slice(0, limite).map((p) => <button key={p.url} type="button" onClick={() => setAperto(p)} className="flex flex-col rounded-lg border-[0.8px] border-bordo-scheda bg-card p-3 text-left transition-colors hover:border-primary">
          <Immagine src={p.foto} alt={p.nome} className="h-40 w-full" />
          <span className="mt-3 font-medium leading-snug">{p.nome}</span>
          <span className="mt-1 text-xs text-muted-foreground">art. {p.codice}{p.varianti.length > 1 ? ` · ${p.varianti.length} varianti` : ""}</span>
          <span className="mt-2 flex gap-2 text-[11px] text-muted-foreground">{p.scheda && <span className="rounded-full bg-muted px-2 py-0.5">PDF</span>}{p.disegno2d && <span className="rounded-full bg-muted px-2 py-0.5">2D</span>}{p.file3d.stp && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Box className="size-3" />3D</span>}</span>
        </button>)}</div>
        {risultati.length > limite && <div className="mt-6 flex justify-center"><Button variant="outline" onClick={() => setLimite((l) => l + PAGINA)}>Mostra altri</Button></div>}
      </>}
      {aperto && <Dettaglio p={aperto} onClose={() => setAperto(null)} />}
    </main>
  </>;
}
