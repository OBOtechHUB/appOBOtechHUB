/**
 * Pianta 2D dell'edificio: si scelgono i corpi e se ne modificano le quote; si aggiungono blocchi sul tetto
 * (volumi tecnici, UTA, torrini…) puntandoli in pianta con altezza manuale; le altezze si leggono anche da un
 * prospetto o da una sezione 2D (PDF o immagine) calibrati con due punti a distanza nota e la linea di terra.
 */
import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { MousePointer2, Square, Pentagon, FileImage, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { CampoNumero } from "@/components/CampoNumero";
import type { Corpo, Punto2 } from "@/calcoli/edificio/tipi";
import { applicaQuota, bloccoDaPunti, centroide, corpoSotto, improntaDaPunti, quotaDaProspetto, quotaGronda, scalaDaDuePunti, sommita, type P } from "@/calcoli/edificio/pianta2D";
import { massimo, minimo } from "@/lib/estremi";
import type { PianoImportato } from "@/lib/leggiPdf";

const f2 = (v: number) => v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
type Modo = "seleziona" | "rettangolo" | "poligono";

export function Pianta2D({ corpi, onModifica, onAggiungi }: { corpi: Corpo[]; onModifica: (id: string, p: Partial<Corpo>) => void; onAggiungi: (c: Corpo) => void }) {
  const [sel, setSel] = useState<string | null>(null), [modo, setModo] = useState<Modo>("seleziona"), [punti, setPunti] = useState<Punto2[]>([]);
  const [altezza, setAltezza] = useState<number | null>(2.5), [base, setBase] = useState<number | null>(null), [nome, setNome] = useState("");
  const svg = useRef<SVGSVGElement | null>(null);
  const scelto = corpi.find((c) => c.id === sel) ?? null;

  const vista = useMemo(() => {
    const xs = corpi.flatMap((c) => c.impronta.map((p) => p[0])), ys = corpi.flatMap((c) => c.impronta.map((p) => p[1]));
    const x0 = xs.length ? minimo(xs) : 0, x1 = xs.length ? massimo(xs) : 20, y0 = ys.length ? minimo(ys) : 0, y1 = ys.length ? massimo(ys) : 20;
    const lato = Math.max(x1 - x0, y1 - y0, 5), pad = lato * 0.06;
    return { x0: x0 - pad, y1: y1 + pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad, testo: lato / 45, hMax: massimo([1, ...corpi.map(sommita)]) };
  }, [corpi]);
  const sx = (p: Punto2) => `${p[0] - vista.x0},${vista.y1 - p[1]}`;
  const ordinati = [...corpi].sort((a, b) => sommita(a) - sommita(b));
  const anteprima = modo === "rettangolo" && punti.length === 2 ? improntaDaPunti(punti) : modo === "poligono" && punti.length >= 3 ? punti : null;
  const pronto = (modo === "rettangolo" && punti.length === 2) || (modo === "poligono" && punti.length >= 3);
  const baseAuto = anteprima ? (() => { const c = corpoSotto(centroide(anteprima), corpi); return c ? quotaGronda(c) : 0; })() : 0;

  function clic(e: ReactMouseEvent<SVGSVGElement>) {
    const el = svg.current; if (!el) return;
    const m = el.getScreenCTM(); if (!m) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const p: Punto2 = [Math.round((pt.x + vista.x0) * 100) / 100, Math.round((vista.y1 - pt.y) * 100) / 100];
    if (modo === "seleziona") { const c = corpoSotto(p, ordinati.filter((x) => !x.mesh)); setSel(c?.id ?? null); return; }
    if (modo === "rettangolo") setPunti((q) => (q.length >= 2 ? [p] : [...q, p]));
    else setPunti((q) => [...q, p]);
  }
  function annulla() { setPunti([]); setBase(null); setNome(""); }
  function aggiungi() {
    const b = bloccoDaPunti(punti, altezza ?? 0, corpi, { id: crypto.randomUUID(), nome, quotaBase: base });
    if (!b) return;
    onAggiungi(b); setSel(b.id); annulla(); setModo("seleziona");
  }

  return <section className="mt-8 border-t pt-5" aria-labelledby="h-pianta2d">
    <h2 id="h-pianta2d" className="font-display text-xl font-semibold">Pianta 2D, altezze e blocchi sul tetto</h2>
    <p className="mt-1 text-sm text-muted-foreground">Tocca un corpo per modificarne le quote. Con «Rettangolo» o «Poligono» punti in pianta un blocco sul tetto (volume tecnico, UTA, torrino, vano scala…) e ne scrivi l'altezza: la base si appoggia da sola sulla copertura sotto. Le altezze si leggono anche da un prospetto o da una sezione qui sotto.</p>
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Modo della pianta">
      {([["seleziona", "Scegli corpo", MousePointer2], ["rettangolo", "Rettangolo", Square], ["poligono", "Poligono", Pentagon]] as const).map(([m, t, I]) =>
        <Button key={m} size="sm" variant={modo === m ? "default" : "outline"} aria-pressed={modo === m} onClick={() => { setModo(m); setPunti([]); }}><I />{t}</Button>)}
      {modo === "poligono" && punti.length > 0 && <Button size="sm" variant="ghost" onClick={() => setPunti((q) => q.slice(0, -1))}>Togli l'ultimo punto</Button>}
    </div>
    <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <svg ref={svg} role="img" aria-label="Pianta dei corpi dell'edificio" viewBox={`0 0 ${vista.w} ${vista.h}`} className={`w-full rounded-md border bg-white ${modo === "seleziona" ? "cursor-pointer" : "cursor-crosshair"}`} style={{ maxHeight: 520 }} onClick={clic}>
        {ordinati.map((c) => { const t = sommita(c) / vista.hMax, attivo = c.id === sel, [cx, cy] = centroide(c.impronta);
          return <g key={c.id}>
            <polygon points={c.impronta.map(sx).join(" ")} fill={`rgba(243,146,0,${0.12 + 0.5 * t})`} stroke={attivo ? "#e2001a" : "#41525d"} strokeWidth={vista.testo * (attivo ? 0.3 : 0.12)} />
            <text x={cx - vista.x0} y={vista.y1 - cy} fontSize={vista.testo} textAnchor="middle" fill="#1d262c" style={{ pointerEvents: "none" }}>{c.nome}</text>
            <text x={cx - vista.x0} y={vista.y1 - cy + vista.testo * 1.15} fontSize={vista.testo * 0.9} textAnchor="middle" fill="#1d262c" style={{ pointerEvents: "none" }}>+{f2(sommita(c))} m</text>
          </g>; })}
        {anteprima && <polygon points={anteprima.map(sx).join(" ")} fill="rgba(226,0,26,.15)" stroke="#e2001a" strokeDasharray={`${vista.testo * 0.4}`} strokeWidth={vista.testo * 0.15} />}
        {modo === "poligono" && punti.length > 1 && <polyline points={punti.map(sx).join(" ")} fill="none" stroke="#e2001a" strokeWidth={vista.testo * 0.12} />}
        {punti.map((p, i) => <circle key={i} cx={p[0] - vista.x0} cy={vista.y1 - p[1]} r={vista.testo * 0.3} fill="#e2001a" />)}
      </svg>
      <div className="space-y-4">
        {pronto && <div className="rounded-md border border-primary p-3">
          <h3 className="font-semibold">Nuovo blocco sul tetto</h3>
          <div className="mt-2 grid gap-2">
            <Campo etichetta="Nome"><input className={inputCls} value={nome} placeholder="Es. UTA, vano scala, torrino" maxLength={200} onChange={(e) => setNome(e.target.value)} /></Campo>
            <Campo etichetta="Altezza del blocco (m)"><CampoNumero className={inputCls} valore={altezza} min={0} onValore={setAltezza} /></Campo>
            <Campo etichetta={`Quota di appoggio (m) · dalla copertura: ${f2(baseAuto)}`}><CampoNumero className={inputCls} valore={base} placeholder={f2(baseAuto)} onValore={setBase} /></Campo>
            <p className="text-xs text-muted-foreground">Sommità: +{f2((base ?? baseAuto) + (altezza ?? 0))} m</p>
            <div className="flex gap-2"><Button size="sm" disabled={!(altezza && altezza > 0)} onClick={aggiungi}><Plus />Aggiungi blocco</Button><Button size="sm" variant="outline" onClick={annulla}><X />Annulla</Button></div>
          </div>
        </div>}
        {!pronto && modo !== "seleziona" && <p className="rounded-md bg-muted p-3 text-sm">{modo === "rettangolo" ? "Tocca due angoli opposti del blocco in pianta." : "Tocca i vertici del blocco in pianta (almeno 3)."}</p>}
        {scelto ? <div className="rounded-md border p-3">
          <h3 className="font-semibold">{scelto.nome}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Campo etichetta="Quota base (m)"><CampoNumero className={inputCls} valore={scelto.quotaBase ?? 0} onValore={(v) => onModifica(scelto.id, { quotaBase: v ?? 0 })} /></Campo>
            <Campo etichetta="Altezza gronda (m)"><CampoNumero className={inputCls} valore={scelto.altezzaGronda} min={0} onValore={(v) => onModifica(scelto.id, scelto.tipoTetto === "falde" ? { altezzaGronda: v ?? 0 } : { altezzaGronda: v ?? 0, altezzaColmo: v ?? 0 })} /></Campo>
            <Campo etichetta="Copertura"><select className={inputCls} value={scelto.tipoTetto} onChange={(e) => { const t = e.target.value as Corpo["tipoTetto"]; onModifica(scelto.id, { tipoTetto: t, altezzaColmo: t === "falde" ? Math.max(scelto.altezzaColmo, scelto.altezzaGronda + 1) : scelto.altezzaGronda }); }}><option value="piano">Piana</option><option value="falde">A falde</option><option value="altro">Altro</option></select></Campo>
            {scelto.tipoTetto === "falde" && <Campo etichetta="Altezza colmo (m)"><CampoNumero className={inputCls} valore={scelto.altezzaColmo} min={0} onValore={(v) => onModifica(scelto.id, { altezzaColmo: v ?? 0 })} /></Campo>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Gronda a +{f2(quotaGronda(scelto))} m · sommità a +{f2(sommita(scelto))} m dal terreno</p>
        </div> : modo === "seleziona" && <p className="rounded-md bg-muted p-3 text-sm">Tocca un corpo nella pianta per modificarne le quote.</p>}
      </div>
    </div>
    <Prospetto scelto={scelto} bloccoAperto={pronto} baseBlocco={base ?? baseAuto} onQuota={(q, cosa) => { if (cosa === "blocco") setAltezza(Math.max(0, Math.round((q - (base ?? baseAuto)) * 100) / 100)); else if (scelto) onModifica(scelto.id, applicaQuota(scelto, q, cosa)); }} />
  </section>;
}

/** Prospetto o sezione 2D: calibrazione con due punti, linea di terra, lettura delle quote. */
function Prospetto({ scelto, bloccoAperto, baseBlocco, onQuota }: { scelto: Corpo | null; bloccoAperto: boolean; baseBlocco: number; onQuota: (q: number, cosa: "gronda" | "colmo" | "base" | "blocco") => void }) {
  const [img, setImg] = useState<PianoImportato | null>(null), [nomeFile, setNomeFile] = useState(""), [errore, setErrore] = useState(""), [busy, setBusy] = useState(false);
  const [fase, setFase] = useState<"calibra" | "terra" | "leggi">("calibra"), [cal, setCal] = useState<P[]>([]), [metri, setMetri] = useState<number | null>(null);
  const [terra, setTerra] = useState<number | null>(null), [letto, setLetto] = useState<P | null>(null), [zoom, setZoom] = useState(1);
  const svg = useRef<SVGSVGElement | null>(null);
  const mpp = cal.length === 2 && metri ? scalaDaDuePunti(cal[0]!, cal[1]!, metri) : null;
  const quota = letto && terra != null && mpp ? quotaDaProspetto(terra, letto.y, mpp) : null;

  async function apri(file: File) {
    setBusy(true); setErrore("");
    try {
      const { leggiPdf, leggiImmagine } = await import("@/lib/leggiPdf");
      const p = /\.pdf$/i.test(file.name) ? await leggiPdf(file, 1) : await leggiImmagine(file);
      setImg(p); setNomeFile(file.name); setCal([]); setTerra(null); setLetto(null); setFase("calibra"); setZoom(1);
    } catch (e) { setErrore(e instanceof Error ? e.message : "File non leggibile."); } finally { setBusy(false); }
  }
  function clic(e: ReactMouseEvent<SVGSVGElement>) {
    const el = svg.current, m = el?.getScreenCTM(); if (!el || !m) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()), p = { x: pt.x, y: pt.y };
    if (fase === "calibra") setCal((q) => (q.length >= 2 ? [p] : [...q, p]));
    else if (fase === "terra") { setTerra(p.y); setFase("leggi"); }
    else setLetto(p);
  }
  const r = img ? Math.max(img.larghezzaPx, img.altezzaPx) / 150 : 1;

  return <details className="mt-5 rounded-md border p-4">
    <summary className="cursor-pointer font-semibold"><FileImage className="mr-1 inline size-4" />Altezze da un prospetto o da una sezione (PDF o immagine)</summary>
    <p className="mt-2 text-sm text-muted-foreground">1) Calibra: tocca due punti di cui conosci la distanza (una quota scritta, una campata) e scrivi i metri. 2) Tocca la linea di terra (±0,00). 3) Tocca il punto più alto del corpo o del blocco: la quota si applica al corpo scelto in pianta o al nuovo blocco.</p>
    <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" className="mt-2 text-sm" aria-label="Prospetto o sezione" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.currentTarget.value = ""; if (f) void apri(f); }} />
    {busy && <p className="mt-2 text-sm">Apro il file…</p>}{errore && <p role="alert" className="mt-2 text-sm text-destructive">{errore}</p>}
    {img && <>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        {(["calibra", "terra", "leggi"] as const).map((f, i) => <Button key={f} size="sm" variant={fase === f ? "default" : "outline"} aria-pressed={fase === f} disabled={f !== "calibra" && !mpp} onClick={() => setFase(f)}>{i + 1}. {f === "calibra" ? "Calibra" : f === "terra" ? "Linea di terra" : "Leggi quota"}</Button>)}
        {fase === "calibra" && <Campo etichetta="Distanza tra i due punti (m)"><CampoNumero className={`${inputCls} w-32`} valore={metri} min={0} onValore={setMetri} /></Campo>}
        <Campo etichetta="Zoom"><select className={`${inputCls} w-24`} value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>{[1, 1.5, 2, 3, 4].map((z) => <option key={z} value={z}>{z}×</option>)}</select></Campo>
        <span className="text-xs text-muted-foreground">{nomeFile}{mpp ? ` · 1 px = ${mpp.toLocaleString("it-IT", { maximumFractionDigits: 4 })} m` : ""}</span>
      </div>
      <div className="mt-2 max-h-[70vh] overflow-auto rounded-md border bg-white">
        <svg ref={svg} viewBox={`0 0 ${img.larghezzaPx} ${img.altezzaPx}`} style={{ width: `${100 * zoom}%` }} className="cursor-crosshair" onClick={clic} role="img" aria-label="Prospetto">
          <image href={img.immagine} width={img.larghezzaPx} height={img.altezzaPx} />
          {cal.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={r} fill="#1d7a45" />)}
          {cal.length === 2 && <line x1={cal[0]!.x} y1={cal[0]!.y} x2={cal[1]!.x} y2={cal[1]!.y} stroke="#1d7a45" strokeWidth={r / 2} />}
          {terra != null && <line x1={0} x2={img.larghezzaPx} y1={terra} y2={terra} stroke="#41525d" strokeWidth={r / 2} strokeDasharray={`${r * 2}`} />}
          {letto && <><line x1={0} x2={img.larghezzaPx} y1={letto.y} y2={letto.y} stroke="#e2001a" strokeWidth={r / 2} /><circle cx={letto.x} cy={letto.y} r={r} fill="#e2001a" /></>}
        </svg>
      </div>
      {quota != null && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-muted p-3 text-sm">
        <b>Quota letta: +{f2(quota)} m</b>
        {scelto && <><span>· {scelto.nome}:</span>
          <Button size="sm" variant="outline" onClick={() => onQuota(quota, "gronda")}>Usa come gronda</Button>
          <Button size="sm" variant="outline" onClick={() => onQuota(quota, "colmo")}>Usa come colmo</Button>
          <Button size="sm" variant="outline" onClick={() => onQuota(quota, "base")}>Usa come quota base</Button></>}
        {bloccoAperto && <Button size="sm" onClick={() => onQuota(quota, "blocco")}>Sommità del nuovo blocco (altezza {f2(Math.max(0, quota - baseBlocco))} m)</Button>}
        {!scelto && !bloccoAperto && <span className="text-muted-foreground">Scegli un corpo in pianta o punta un nuovo blocco per applicare la quota.</span>}
      </div>}
    </>}
  </details>;
}
