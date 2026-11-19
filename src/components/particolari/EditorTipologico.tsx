/**
 * Editor grafico dei tipologici: si mettono i blocchi OBO, si collegano con conduttori o quote, si assegnano
 * codici e quantità e si salva come nuovo particolare (con distinta e disegno usati da computo e relazione).
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as PE } from "react";
import { MousePointer2, Spline, Ruler, Type, Undo2, Redo2, Trash2, Copy, RotateCw, Download, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { useCatalogoObo, trovaArticolo } from "@/lib/catalogoObo";
import {
  CATEGORIE_SIMBOLI, NOMI_UNITA, SIMBOLI, STRUTTURA, TIPI_BLOCCO, UNITA_QUANTITA, componentiTipologico, disegnoObo, disegnoVuoto, ingombro, markupBlocco, markupConduttore, percorso, quota, svgTipologico, tipoDaDescrizione,
  type BloccoTip, type CollegamentoTip, type DisegnoTip, type TestoTip, type TipoBlocco, type UnitaQuantita,
} from "@/calcoli/particolari/tipologico";
import { scarica } from "@/lib/esportazioni";
import { svgPng } from "@/components/progetto/RelazioneTecnica";
import { incorporaImmagini, useDisegniObo } from "@/lib/disegniObo";

export interface DatiSalvataggio { nome: string; categoria: "captazione" | "calata" | "raccordo" | "terra" | "impianti_tetto"; elemento: string; tipo: string; note: string }
type Modo = "sposta" | "collega" | "quota" | "testo";
type Sel = { k: "b" | "c" | "t"; id: string } | null;
const CATEGORIE: [DatiSalvataggio["categoria"], string][] = [["captazione", "Captazione"], ["raccordo", "Raccordo"], ["impianti_tetto", "Impianti sul tetto"], ["calata", "Calata"], ["terra", "Terra"]];
const snap = (v: number) => Math.round(v / 5) * 5;
let contatore = 0;
const nuovoId = (p: string) => `${p}${Date.now().toString(36)}${(contatore++).toString(36)}`;

export function EditorTipologico({ iniziale, datiIniziali, onSalva, onChiudi }: { iniziale?: DisegnoTip; datiIniziali?: Partial<DatiSalvataggio>; onSalva: (d: DisegnoTip, dati: DatiSalvataggio) => Promise<void> | void; onChiudi: () => void }) {
  const [d, setD] = useState<DisegnoTip>(iniziale ?? disegnoVuoto());
  const [storia, setStoria] = useState<{ indietro: DisegnoTip[]; avanti: DisegnoTip[] }>({ indietro: [], avanti: [] });
  const [sel, setSel] = useState<Sel>(null), [modo, setModo] = useState<Modo>("sposta"), [primo, setPrimo] = useState<string | null>(null);
  const [dati, setDati] = useState<DatiSalvataggio>({ nome: "", categoria: "captazione", elemento: "", tipo: "", note: "", ...datiIniziali });
  const [msg, setMsg] = useState(""), [salvo, setSalvo] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const trascina = useRef<{ id: string; k: "b" | "t"; dx: number; dy: number; prima: DisegnoTip; mosso: boolean } | null>(null);
  const { catalogo } = useCatalogoObo();
  const obo = useDisegniObo();
  const [codiceNuovo, setCodiceNuovo] = useState("");
  const { componenti, richiami } = useMemo(() => componentiTipologico(d), [d]);

  /** modifica con annullamento */
  const cambia = (f: (x: DisegnoTip) => DisegnoTip) => { setStoria((s) => ({ indietro: [...s.indietro.slice(-80), d], avanti: [] })); setD((x) => f(x)); };
  const annulla = () => { const p = storia.indietro.at(-1); if (!p) return; setStoria({ indietro: storia.indietro.slice(0, -1), avanti: [d, ...storia.avanti] }); setD(p); };
  const ripeti = () => { const n = storia.avanti[0]; if (!n) return; setStoria({ indietro: [...storia.indietro, d], avanti: storia.avanti.slice(1) }); setD(n); };
  const elimina = () => {
    if (!sel) return;
    cambia((x) => sel.k === "b" ? { ...x, blocchi: x.blocchi.filter((b) => b.id !== sel.id), collegamenti: x.collegamenti.filter((c) => c.da !== sel.id && c.a !== sel.id) }
      : sel.k === "c" ? { ...x, collegamenti: x.collegamenti.filter((c) => c.id !== sel.id) } : { ...x, testi: x.testi.filter((t) => t.id !== sel.id) });
    setSel(null);
  };
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); elimina(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) ripeti(); else annulla(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); ripeti(); }
      else if (e.key === "Escape") { setSel(null); setPrimo(null); setModo("sposta"); }
      else if (sel && sel.k !== "c" && e.key.startsWith("Arrow")) {
        e.preventDefault(); const p = e.shiftKey ? 20 : 5, dx = e.key === "ArrowLeft" ? -p : e.key === "ArrowRight" ? p : 0, dy = e.key === "ArrowUp" ? -p : e.key === "ArrowDown" ? p : 0;
        cambia((x) => sel.k === "b" ? { ...x, blocchi: x.blocchi.map((b) => (b.id === sel.id ? { ...b, x: b.x + dx, y: b.y + dy } : b)) } : { ...x, testi: x.testi.map((tt) => (tt.id === sel.id ? { ...tt, x: tt.x + dx, y: tt.y + dy } : tt)) });
      }
    };
    window.addEventListener("keydown", tasto); return () => window.removeEventListener("keydown", tasto);
  });

  const punto = (e: { clientX: number; clientY: number }): [number, number] => {
    const svg = svgRef.current, m = svg?.getScreenCTM(); if (!svg || !m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return [p.x, p.y];
  };
  const aggiungiBlocco = (tipo: TipoBlocco) => {
    const s = SIMBOLI[tipo], id = nuovoId("b");
    const larga = STRUTTURA.has(tipo) && (tipo === "copertura" || tipo === "terreno");
    const b: BloccoTip = { id, tipo, x: snap(d.larghezza / 2 + (d.blocchi.length % 5) * 20 - 40), y: larga ? snap(d.altezza - 60) : snap(d.altezza / 2 + (d.blocchi.length % 4) * 15 - 30), rot: 0, scala: larga ? Math.max(1, Math.round(((d.larghezza - 60) / 300) * 10) / 10) : 1, codiceOBO: "", descrizione: "", quantita: 1, unita: s.unita, vista: "simbolo", larghezzaObo: 140 };
    cambia((x) => ({ ...x, blocchi: [...x.blocchi, b] })); setSel({ k: "b", id }); setModo("sposta");
  };
  /** blocco da codice OBO: tipo dal nome del catalogo, disegno ufficiale OBO se disponibile */
  const aggiungiDaCodice = () => {
    const codice = codiceNuovo.trim(); if (!codice) return;
    const a = catalogo ? trovaArticolo(catalogo, codice) : null, nome = a ? `${a.prodotto.nome}${a.variante ? ` ${a.variante.valori.join(" ")}` : ""}` : "";
    const tipo = tipoDaDescrizione(nome || codice), id = nuovoId("b");
    const b: BloccoTip = { id, tipo, x: snap(d.larghezza / 2), y: snap(d.altezza / 2), rot: 0, scala: 1, codiceOBO: codice, descrizione: nome, quantita: 1, unita: SIMBOLI[tipo].unita, vista: obo?.codici[codice] ? "obo" : "simbolo", larghezzaObo: 140 };
    cambia((x) => ({ ...x, blocchi: [...x.blocchi, b] })); setSel({ k: "b", id }); setModo("sposta"); setCodiceNuovo("");
  };
  const giuBlocco = (e: PE<SVGGElement>, b: BloccoTip) => {
    e.stopPropagation();
    if (modo === "collega" || modo === "quota") {
      if (!primo) { setPrimo(b.id); setSel({ k: "b", id: b.id }); return; }
      if (primo !== b.id) {
        const id = nuovoId("k");
        const c: CollegamentoTip = { id, da: primo, a: b.id, tipo: modo === "quota" ? "quota" : "conduttore", ortogonale: false, codiceOBO: "", descrizione: "", quantita: 1, unita: "per_m", testo: modo === "quota" ? "max 1 m" : "" };
        cambia((x) => ({ ...x, collegamenti: [...x.collegamenti, c] })); setSel({ k: "c", id });
      }
      setPrimo(null); return;
    }
    const [px, py] = punto(e); setSel({ k: "b", id: b.id });
    trascina.current = { id: b.id, k: "b", dx: px - b.x, dy: py - b.y, prima: d, mosso: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const giuTesto = (e: PE<SVGTextElement>, t: TestoTip) => {
    e.stopPropagation(); const [px, py] = punto(e); setSel({ k: "t", id: t.id });
    trascina.current = { id: t.id, k: "t", dx: px - t.x, dy: py - t.y, prima: d, mosso: false };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const muovi = (e: PE<SVGSVGElement>) => {
    const tr = trascina.current; if (!tr) return;
    const [px, py] = punto(e), nx = snap(px - tr.dx), ny = snap(py - tr.dy); tr.mosso = true;
    setD((x) => tr.k === "b" ? { ...x, blocchi: x.blocchi.map((b) => (b.id === tr.id ? { ...b, x: nx, y: ny } : b)) } : { ...x, testi: x.testi.map((t) => (t.id === tr.id ? { ...t, x: nx, y: ny } : t)) });
  };
  const su = () => { const tr = trascina.current; trascina.current = null; if (tr?.mosso) setStoria((s) => ({ indietro: [...s.indietro.slice(-80), tr.prima], avanti: [] })); };
  const giuSfondo = (e: PE<SVGSVGElement>) => {
    if (modo === "testo") { const [px, py] = punto(e); const id = nuovoId("t"); cambia((x) => ({ ...x, testi: [...x.testi, { id, x: snap(px), y: snap(py), t: "Testo", dim: 12 }] })); setSel({ k: "t", id }); setModo("sposta"); return; }
    setSel(null); setPrimo(null);
  };

  const bSel = sel?.k === "b" ? d.blocchi.find((b) => b.id === sel.id) : undefined;
  const cSel = sel?.k === "c" ? d.collegamenti.find((c) => c.id === sel.id) : undefined;
  const tSel = sel?.k === "t" ? d.testi.find((t) => t.id === sel.id) : undefined;
  const setB = (p: Partial<BloccoTip>) => bSel && cambia((x) => ({ ...x, blocchi: x.blocchi.map((b) => (b.id === bSel.id ? { ...b, ...p } : b)) }));
  const setC = (p: Partial<CollegamentoTip>) => cSel && cambia((x) => ({ ...x, collegamenti: x.collegamenti.map((c) => (c.id === cSel.id ? { ...c, ...p } : c)) }));
  const setT = (p: Partial<TestoTip>) => tSel && cambia((x) => ({ ...x, testi: x.testi.map((t) => (t.id === tSel.id ? { ...t, ...p } : t)) }));
  /** codice OBO: se nel catalogo, propone la descrizione */
  const nomeCatalogo = (codice: string) => { if (!catalogo || !codice.trim()) return ""; const a = trovaArticolo(catalogo, codice.trim()); return a ? `${a.prodotto.nome}${a.variante ? ` ${a.variante.valori.join(" ")}` : ""}` : ""; };
  const codiceBlur = (codice: string, descr: string, set: (p: { descrizione: string }) => void) => { if (!descr.trim()) { const n = nomeCatalogo(codice); if (n) set({ descrizione: n }); } };

  async function esporta(formato: "svg" | "png") {
    const svg = svgTipologico(d, { titolo: dati.nome || "Tipologico", legenda: true, obo }), nome = (dati.nome || "tipologico").replace(/[^\w.-]+/g, "_");
    if (formato === "svg") scarica(new Blob([await incorporaImmagini(svg)], { type: "image/svg+xml" }), `${nome}.svg`);
    else { const w = Number(svg.match(/width="(\d+)"/)?.[1] ?? 800); { const png = await svgPng(svg, (w / 96) * 2.54 * 1.5); scarica(new Blob([new Uint8Array(png)], { type: "image/png" }), `${nome}.png`); } }
  }
  async function salva() {
    setMsg("");
    if (!dati.nome.trim()) { setMsg("Dai un nome al tipologico."); return; }
    if (!componenti.length) { setMsg("Aggiungi almeno un componente OBO (blocco o conduttore con codice o descrizione)."); return; }
    setSalvo(true);
    try { await onSalva(d, { ...dati, nome: dati.nome.trim() }); setMsg("Tipologico salvato nella libreria dei particolari."); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Salvataggio non riuscito."); }
    finally { setSalvo(false); }
  }

  const unitaSel = (v: UnitaQuantita, on: (u: UnitaQuantita) => void, label = "Unità della quantità") => <Campo etichetta={label}><select className={inputCls} value={v} onChange={(e) => on(e.target.value as UnitaQuantita)}>{UNITA_QUANTITA.map((u) => <option key={u} value={u}>{NOMI_UNITA[u]}</option>)}</select></Campo>;
  const strumento = (m: Modo, Icona: typeof Spline, testo: string) => <Button type="button" size="sm" variant={modo === m ? "default" : "outline"} aria-pressed={modo === m} onClick={() => { setModo(m); setPrimo(null); }}><Icona />{testo}</Button>;

  return <section className="mt-6 rounded-lg border-[0.8px] border-primary bg-background p-4" aria-labelledby="h-editor-tip">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="h-editor-tip" className="font-display text-lg font-semibold">Disegna tipologico</h2>
      <Button type="button" variant="outline" size="sm" onClick={onChiudi}><X />Chiudi</Button>
    </div>
    <p className="mt-1 text-sm text-muted-foreground">Scegli i blocchi a sinistra, trascinali nel disegno e collegali con <b>Collega</b> (clic sul primo blocco, poi sul secondo). Seleziona un elemento per dargli codice OBO, descrizione e quantità per applicazione. Canc elimina, Ctrl+Z annulla, frecce spostano.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {strumento("sposta", MousePointer2, "Seleziona")}{strumento("collega", Spline, "Collega")}{strumento("quota", Ruler, "Quota")}{strumento("testo", Type, "Testo")}
      <Button type="button" size="sm" variant="outline" disabled={!storia.indietro.length} onClick={annulla} aria-label="Annulla"><Undo2 /></Button>
      <Button type="button" size="sm" variant="outline" disabled={!storia.avanti.length} onClick={ripeti} aria-label="Ripeti"><Redo2 /></Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void esporta("svg")}><Download />SVG</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => void esporta("png")}><Download />PNG</Button>
      {primo && <span role="status" className="self-center text-sm text-accent-foreground">Ora clicca il secondo blocco…</span>}
    </div>
    <div className="mt-3 grid gap-3 lg:grid-cols-[11rem_1fr_16rem]">
      <div className="max-h-[34rem] space-y-3 overflow-y-auto pr-1" aria-label="Blocchi">
        <div><p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Da codice OBO</p>
          <div className="flex gap-1"><input className={`${inputCls} py-1 text-sm`} value={codiceNuovo} maxLength={40} placeholder="es. 5218700" aria-label="Codice OBO del blocco" onChange={(e) => setCodiceNuovo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") aggiungiDaCodice(); }} /><Button type="button" size="sm" onClick={aggiungiDaCodice}>+</Button></div>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">Usa il disegno ufficiale OBO del prodotto, se presente.</p></div>
        {CATEGORIE_SIMBOLI.map((cat) => <div key={cat}><p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{cat}</p>
          <div className="grid grid-cols-2 gap-1 lg:grid-cols-1">{TIPI_BLOCCO.filter((t) => SIMBOLI[t].categoria === cat).map((t) => { const s = SIMBOLI[t], m = Math.max(s.mezzo[0], s.mezzo[1]) + 6;
            return <button key={t} type="button" onClick={() => aggiungiBlocco(t)} className="flex items-center gap-2 rounded border px-1.5 py-1 text-left text-xs hover:border-accent hover:bg-accent/10" title={`Aggiungi: ${s.nome}`}>
              <svg viewBox={`${-m} ${-m} ${2 * m} ${2 * m}`} className="h-7 w-7 shrink-0 text-foreground" aria-hidden="true"><g dangerouslySetInnerHTML={{ __html: s.forme }} /></svg><span className="leading-tight">{s.nome}</span></button>; })}</div></div>)}
      </div>
      <div className="min-w-0">
        <svg ref={svgRef} viewBox={`0 0 ${d.larghezza} ${d.altezza}`} className="w-full touch-none select-none rounded border bg-white text-[#282A31]" style={{ aspectRatio: `${d.larghezza} / ${d.altezza}`, cursor: modo === "testo" ? "text" : modo === "sposta" ? "default" : "crosshair" }}
          onPointerDown={giuSfondo} onPointerMove={muovi} onPointerUp={su} onPointerCancel={su} role="application" aria-label="Area di disegno del tipologico">
          <defs><pattern id="griglia-tip" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20,0 L0,0 0,20" fill="none" stroke="#E4EBED" strokeWidth="1" /></pattern>
            <marker id="fr-ed" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,2 L10,5 L0,8 z" fill="#41525D" /></marker></defs>
          <rect width={d.larghezza} height={d.altezza} fill="url(#griglia-tip)" />
          {d.collegamenti.map((c) => { const pts = percorso(c, d.blocchi, obo); if (!pts) return null; const s = pts.map((p) => p.join(",")).join(" "), attivo = sel?.k === "c" && sel.id === c.id;
            const onDown = (e: PE<SVGGElement>) => { e.stopPropagation(); setSel({ k: "c", id: c.id }); };
            if (c.tipo === "quota") { const q = quota(pts[0]!, pts[pts.length - 1]!);
              return <g key={c.id} onPointerDown={onDown} className="cursor-pointer" color={attivo ? "#F39B00" : "#41525D"}><polyline points={q.linea} fill="none" stroke="transparent" strokeWidth="14" /><polyline points={q.estensioni[0]} fill="none" stroke="currentColor" strokeWidth="0.8" /><polyline points={q.estensioni[1]} fill="none" stroke="currentColor" strokeWidth="0.8" /><polyline points={q.linea} fill="none" stroke="currentColor" strokeWidth="1" markerStart="url(#fr-ed)" markerEnd="url(#fr-ed)" /><text x={q.tx} y={q.ty} fontSize="12" textAnchor="middle" fill="currentColor" transform={`rotate(${q.ang} ${q.tx} ${q.ty})`}>{c.testo}</text></g>; }
            return <g key={c.id} onPointerDown={onDown} className="cursor-pointer"><polyline points={s} fill="none" stroke="transparent" strokeWidth="14" /><g dangerouslySetInnerHTML={{ __html: markupConduttore(s, c.tipo === "quota" ? "linea" : c.tipo) }} />{attivo && <polyline points={s} fill="none" stroke="#F39B00" strokeWidth="2" strokeDasharray="5 4" />}</g>; })}
          {[...d.blocchi.filter((x) => STRUTTURA.has(x.tipo)), ...d.blocchi.filter((x) => !STRUTTURA.has(x.tipo))].map((b) => { const [mx, my] = ingombro(b, obo), attivo = sel?.k === "b" && sel.id === b.id, n = richiami.get(b.id);
            return <g key={b.id} onPointerDown={(e) => giuBlocco(e, b)} className={modo === "sposta" ? "cursor-move" : "cursor-pointer"}>
              <g dangerouslySetInnerHTML={{ __html: markupBlocco(b, obo) }} />
              <rect x={b.x - mx - 4} y={b.y - my - 4} width={2 * mx + 8} height={2 * my + 8} fill="transparent" stroke={attivo || primo === b.id ? "#F39B00" : "none"} strokeWidth="1.5" strokeDasharray="5 4" transform={`rotate(${b.rot} ${b.x} ${b.y})`} />
              {n && <g pointerEvents="none"><circle cx={b.x + mx + 14} cy={b.y - my * 0.5 - 10} r="9" fill="#F39B00" /><text x={b.x + mx + 14} y={b.y - my * 0.5 - 6} fontSize="10" fontWeight="bold" fill="#fff" textAnchor="middle">{n}</text></g>}
            </g>; })}
          {d.testi.map((t) => <text key={t.id} x={t.x} y={t.y} fontSize={t.dim} fill={sel?.k === "t" && sel.id === t.id ? "#F39B00" : "#282A31"} className="cursor-move" onPointerDown={(e) => giuTesto(e, t)}>{t.t}</text>)}
        </svg>
        <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
          <label className="flex items-center gap-1">Larghezza <input className={`${inputCls} w-24 py-1`} inputMode="numeric" value={d.larghezza} onChange={(e) => { const v = Number(e.target.value); if (v >= 200 && v <= 4000) cambia((x) => ({ ...x, larghezza: v })); }} /></label>
          <label className="flex items-center gap-1">Altezza <input className={`${inputCls} w-24 py-1`} inputMode="numeric" value={d.altezza} onChange={(e) => { const v = Number(e.target.value); if (v >= 150 && v <= 4000) cambia((x) => ({ ...x, altezza: v })); }} /></label>
        </div>
      </div>
      <div className="space-y-3" aria-label="Proprietà">
        {!sel && <p className="text-sm text-muted-foreground">Seleziona un blocco, un collegamento o un testo per modificarlo.</p>}
        {bSel && <div className="grid gap-2">
          <p className="text-sm font-semibold">{SIMBOLI[bSel.tipo].nome}{richiami.get(bSel.id) ? ` · pos. ${richiami.get(bSel.id)}` : ""}</p>
          <Campo etichetta="Tipo di blocco"><select className={inputCls} value={bSel.tipo} onChange={(e) => setB({ tipo: e.target.value as TipoBlocco })}>{TIPI_BLOCCO.map((t) => <option key={t} value={t}>{SIMBOLI[t].nome}</option>)}</select></Campo>
          <Campo etichetta="Codice OBO"><input className={inputCls} value={bSel.codiceOBO} maxLength={40} placeholder={STRUTTURA.has(bSel.tipo) ? "(struttura: nessun codice)" : "es. 5402864"} onChange={(e) => setB({ codiceOBO: e.target.value.trim() })} onBlur={(e) => codiceBlur(e.target.value, bSel.descrizione, setB)} /></Campo>
          {nomeCatalogo(bSel.codiceOBO) && <p className="text-xs text-muted-foreground">Catalogo: {nomeCatalogo(bSel.codiceOBO)}</p>}
          {obo?.codici[bSel.codiceOBO.trim()] && <div className="grid gap-1 rounded border bg-muted/30 p-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bSel.vista === "obo"} onChange={(e) => setB({ vista: e.target.checked ? "obo" : "simbolo" })} />Disegno ufficiale OBO del prodotto</label>
            {bSel.vista === "obo" && <label className="flex items-center gap-2 text-xs">Larghezza <input className={`${inputCls} w-20 py-0.5 text-sm`} inputMode="numeric" value={bSel.larghezzaObo} onChange={(e) => { const v = Number(e.target.value); if (v >= 20 && v <= 1500) setB({ larghezzaObo: v }); }} /></label>}
          </div>}
          {bSel.vista === "obo" && !disegnoObo(bSel, obo) && <p className="text-xs text-muted-foreground">Disegno OBO non disponibile per questo codice: si usa il simbolo.</p>}
          <Campo etichetta="Descrizione"><input className={inputCls} value={bSel.descrizione} maxLength={300} placeholder={SIMBOLI[bSel.tipo].nome} onChange={(e) => setB({ descrizione: e.target.value })} /></Campo>
          <div className="grid grid-cols-2 gap-2"><Campo etichetta="Quantità"><input className={inputCls} inputMode="decimal" value={bSel.quantita} onChange={(e) => { const v = Number(e.target.value.replace(",", ".")); if (Number.isFinite(v) && v >= 0) setB({ quantita: v }); }} /></Campo>
            <Campo etichetta="Scala"><input className={inputCls} inputMode="decimal" value={bSel.scala} onChange={(e) => { const v = Number(e.target.value.replace(",", ".")); if (v >= 0.2 && v <= 10) setB({ scala: v }); }} /></Campo></div>
          {unitaSel(bSel.unita, (u) => setB({ unita: u }))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setB({ rot: (bSel.rot + 90) % 360 })}><RotateCw />Ruota</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { const id = nuovoId("b"); cambia((x) => ({ ...x, blocchi: [...x.blocchi, { ...bSel, id, x: bSel.x + 30, y: bSel.y + 10 }] })); setSel({ k: "b", id }); }}><Copy />Duplica</Button>
            <Button type="button" size="sm" variant="outline" onClick={elimina}><Trash2 />Elimina</Button>
          </div>
        </div>}
        {cSel && <div className="grid gap-2">
          <p className="text-sm font-semibold">Collegamento{richiami.get(cSel.id) ? ` · pos. ${richiami.get(cSel.id)}` : ""}</p>
          <Campo etichetta="Tipo"><select className={inputCls} value={cSel.tipo} onChange={(e) => setC({ tipo: e.target.value as CollegamentoTip["tipo"] })}><option value="conduttore">Conduttore tondo</option><option value="piatto">Conduttore piatto</option><option value="quota">Quota</option><option value="linea">Linea sottile (riferimento)</option></select></Campo>
          {cSel.tipo === "quota" ? <Campo etichetta="Testo della quota"><input className={inputCls} value={cSel.testo} maxLength={60} placeholder="es. max 1 m" onChange={(e) => setC({ testo: e.target.value })} /></Campo> : <>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cSel.ortogonale} onChange={(e) => setC({ ortogonale: e.target.checked })} />Percorso ad angolo retto</label>
            {(cSel.tipo === "conduttore" || cSel.tipo === "piatto") && <>
              <Campo etichetta="Codice OBO del conduttore"><input className={inputCls} value={cSel.codiceOBO} maxLength={40} placeholder="es. 5021296" onChange={(e) => setC({ codiceOBO: e.target.value.trim() })} onBlur={(e) => codiceBlur(e.target.value, cSel.descrizione, setC)} /></Campo>
              {nomeCatalogo(cSel.codiceOBO) && <p className="text-xs text-muted-foreground">Catalogo: {nomeCatalogo(cSel.codiceOBO)}</p>}
              <Campo etichetta="Descrizione"><input className={inputCls} value={cSel.descrizione} maxLength={300} placeholder="es. RD 8-ALU conduttore tondo" onChange={(e) => setC({ descrizione: e.target.value })} /></Campo>
              <Campo etichetta="Quantità"><input className={inputCls} inputMode="decimal" value={cSel.quantita} onChange={(e) => { const v = Number(e.target.value.replace(",", ".")); if (Number.isFinite(v) && v >= 0) setC({ quantita: v }); }} /></Campo>
              {unitaSel(cSel.unita, (u) => setC({ unita: u }))}
              <p className="text-xs text-muted-foreground">Un conduttore senza codice né descrizione resta solo nel disegno (non entra nella distinta).</p>
            </>}
          </>}
          <Button type="button" size="sm" variant="outline" onClick={elimina}><Trash2 />Elimina</Button>
        </div>}
        {tSel && <div className="grid gap-2">
          <Campo etichetta="Testo"><input className={inputCls} value={tSel.t} maxLength={200} onChange={(e) => setT({ t: e.target.value })} /></Campo>
          <Campo etichetta="Dimensione"><input className={inputCls} inputMode="numeric" value={tSel.dim} onChange={(e) => { const v = Number(e.target.value); if (v >= 6 && v <= 40) setT({ dim: v }); }} /></Campo>
          <Button type="button" size="sm" variant="outline" onClick={elimina}><Trash2 />Elimina</Button>
        </div>}
      </div>
    </div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><caption className="mb-1 text-left font-semibold">Distinta del tipologico (quantità per applicazione)</caption>
      <thead><tr className="border-b text-left"><th className="p-2">Pos.</th><th className="p-2">Codice</th><th className="p-2">Descrizione</th><th className="p-2">Quantità</th></tr></thead>
      <tbody>{componenti.map((c) => <tr key={c.posizione} className="border-b"><td className="p-2"><span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#F39B00] text-xs font-bold text-white">{c.posizione}</span></td><td className="p-2 font-mono">{c.codiceOBO ?? "—"}</td><td className="p-2">{c.descrizione}</td><td className="p-2">{c.quantita.toLocaleString("it-IT")} {NOMI_UNITA[c.unitaQuantita]}</td></tr>)}
        {!componenti.length && <tr><td colSpan={4} className="p-2 text-muted-foreground">Nessun componente: aggiungi blocchi OBO o conduttori con codice.</td></tr>}</tbody></table></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Campo etichetta="Nome del tipologico"><input className={inputCls} value={dati.nome} maxLength={200} placeholder="es. Asta su treppiede e tondo su tetto piano" onChange={(e) => setDati({ ...dati, nome: e.target.value })} /></Campo>
      <Campo etichetta="Categoria"><select className={inputCls} value={dati.categoria} onChange={(e) => setDati({ ...dati, categoria: e.target.value as DatiSalvataggio["categoria"] })}>{CATEGORIE.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Campo>
      <Campo etichetta="Elemento (a cosa si applica)"><input className={inputCls} value={dati.elemento} maxLength={100} placeholder="es. asta, conduttore, calata" onChange={(e) => setDati({ ...dati, elemento: e.target.value })} /></Campo>
      <Campo etichetta="Tipo / applicazione"><input className={inputCls} value={dati.tipo} maxLength={100} placeholder="es. tetto piano, parete, colmo" onChange={(e) => setDati({ ...dati, tipo: e.target.value })} /></Campo>
      <div className="sm:col-span-2"><Campo etichetta="Note"><textarea className={`${inputCls} min-h-16`} value={dati.note} maxLength={2000} onChange={(e) => setDati({ ...dati, note: e.target.value })} /></Campo></div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <Button type="button" disabled={salvo} onClick={() => void salva()}><Save />{salvo ? "Salvataggio…" : "Salva tipologico"}</Button>
      {msg && <span role="status" className="text-sm">{msg}</span>}
    </div>
  </section>;
}
