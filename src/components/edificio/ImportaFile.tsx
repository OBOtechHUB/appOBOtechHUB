import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import type { Corpo, ModelloEdificio } from "@/calcoli/edificio/tipi";
import { corpoSchema } from "@/calcoli/edificio/tipi";
import {
  SCALE_COMUNI, UNITA, descriviDimensioni, differenzaRelativa, distanza2, fattoreDaMisura, metriPerPuntoPdf, metriUnita, nomeUnita,
  plausibile, proponiUnita, scalaComuneVicina, type PropostaUnita, type Unita,
} from "@/calcoli/importazione/scala";
import { ESTENSIONI_3D, dimensioniCorpo, leggiDXF, leggiMesh, scalaCorpo, unitaDichiarata3D, verticaleZProposto } from "@/lib/importEdificio";
import { leggiImmagine, leggiPdf, type PianoImportato } from "@/lib/leggiPdf";

type Tipo = "dxf" | "3d" | "pdf" | "img";
type P2 = [number, number];
type LetturaDxf = Awaited<ReturnType<typeof leggiDXF>>;

const ACCETTA = ".dxf,.dwg,.pdf,.png,.jpg,.jpeg,.webp,.obj,.stl,.ply,.glb,.gltf,.bin,.ifc,.step,.stp,.iges,.igs";
const num = (v: string) => Number(String(v).replace(",", "."));
const fmt = (v: number, d = 2) => v.toLocaleString("it-IT", { maximumFractionDigits: d });

/**
 * Importazione guidata di disegni e modelli da fonti diverse (CAD 2D, modelli 3D, PDF, immagini di pianta).
 * Per ogni file propone l'unità o la scala più plausibile, chiede conferma e permette la verifica con una misura nota.
 */
export function ImportaFile({ onImporta }: { onImporta: (m: ModelloEdificio) => void }) {
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false), [errore, setErrore] = useState(""), [fatto, setFatto] = useState("");
  // CAD e 3D
  const [dxf, setDxf] = useState<LetturaDxf | null>(null), [layer, setLayer] = useState("");
  const [corpo1, setCorpo1] = useState<Corpo | null>(null), [verticaleZ, setVerticaleZ] = useState(false);
  const [unita, setUnita] = useState<Unita | "misura">("m");
  const [asse, setAsse] = useState<0 | 1 | 2>(0), [reale, setReale] = useState("");
  // PDF e immagini
  const [piano, setPiano] = useState<PianoImportato | null>(null), [rapporto, setRapporto] = useState<number | null>(null);
  const [modo, setModo] = useState<"calibra" | "traccia">("calibra");
  const [cal, setCal] = useState<P2[]>([]), [calReale, setCalReale] = useState("");
  const [poli, setPoli] = useState<P2[]>([]), [altezza, setAltezza] = useState(""), [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement | null>(null);

  function azzera() {
    setTipo(null); setFiles([]); setErrore(""); setDxf(null); setLayer(""); setCorpo1(null); setPiano(null); setRapporto(null);
    setCal([]); setCalReale(""); setPoli([]); setAltezza(""); setReale(""); setUnita("m"); setModo("calibra"); setZoom(1);
  }
  async function esegui(f: () => Promise<void>) {
    setBusy(true); setErrore("");
    try { await f(); } catch (e) { setErrore(e instanceof Error ? e.message : "File non leggibile."); } finally { setBusy(false); }
  }

  async function scegli(lista: File[]) {
    azzera(); setFatto("");
    const main = lista.find((f) => /\.(dxf|dwg|pdf|png|jpe?g|webp)$/i.test(f.name) || ESTENSIONI_3D.test(f.name));
    if (!main) { setErrore("Formato non riconosciuto. Puoi importare DXF, PDF, immagini (PNG, JPG), OBJ, STL, PLY, GLB/GLTF, IFC, STEP e IGES."); return; }
    if (/\.dwg$/i.test(main.name)) { setErrore("Il formato DWG non si può leggere nel browser. Dal programma CAD salva il disegno come DXF (Salva con nome → DXF) e caricalo qui: il DXF conserva le unità."); return; }
    setFiles(lista);
    await esegui(async () => {
      if (/\.dxf$/i.test(main.name)) {
        const r = await leggiDXF(main, 1);
        if (!r.layers.length) throw new Error("Nel DXF non ci sono polilinee: l'impronta dell'edificio va disegnata con polilinee chiuse.");
        setDxf(r); setLayer(r.layers[0] ?? ""); setTipo("dxf");
        setUnita(proponiUnita(r.dimensioni, r.unita).consigliata);
      } else if (/\.pdf$/i.test(main.name)) {
        const p = await leggiPdf(main, 1);
        setPiano(p); setRapporto(p.scalaTesto); setTipo("pdf");
      } else if (/\.(png|jpe?g|webp)$/i.test(main.name)) {
        setPiano(await leggiImmagine(main)); setTipo("img");
      } else {
        const z = verticaleZProposto(main.name);
        const c = await leggiMesh(lista, 1, z);
        setVerticaleZ(z); setCorpo1(c); setTipo("3d");
        setUnita(proponiUnita(dimensioniCorpo(c), unitaDichiarata3D(main.name)).consigliata);
      }
    });
  }
  const main = files[0];

  // ---------- scala di DXF e 3D
  const dimensioniGrezze = useMemo<number[]>(() => tipo === "dxf" && dxf ? dxf.ingombro(layer) : tipo === "3d" && corpo1 ? dimensioniCorpo(corpo1) : [], [tipo, dxf, layer, corpo1]);
  const dichiarata: Unita | null = tipo === "dxf" ? dxf?.unita ?? null : tipo === "3d" && main ? unitaDichiarata3D(main.name) : null;
  const proposta: PropostaUnita | null = dimensioniGrezze.length ? proponiUnita(dimensioniGrezze, dichiarata) : null;
  const fattoreMisura = fattoreDaMisura(dimensioniGrezze[asse] ?? 0, num(reale));
  const fattore = unita === "misura" ? fattoreMisura : metriUnita(unita);
  const dimFinali = fattore ? dimensioniGrezze.map((d) => d * fattore) : [];
  const unitaMisura = fattoreMisura ? UNITA.find((u) => differenzaRelativa(u.metri, fattoreMisura) <= 0.03) : undefined;

  async function cambiaAsse(z: boolean) {
    if (!files.length) return;
    await esegui(async () => { const c = await leggiMesh(files, 1, z); setVerticaleZ(z); setCorpo1(c); });
  }
  function importaCad() {
    if (!fattore) return;
    if (tipo === "dxf" && dxf) {
      const corpi = dxf.corpi(layer).map((c) => ({ ...c, impronta: c.impronta.map((p) => [p[0] * fattore, p[1] * fattore] as P2) }));
      if (!corpi.length) { setErrore("Nel layer scelto non ci sono polilinee chiuse."); return; }
      onImporta({ corpi }); setFatto(`Importati ${corpi.length} ${corpi.length === 1 ? "corpo" : "corpi"} dal layer ${layer}: imposta l'altezza di ciascun corpo nell'elenco.`); azzera();
    } else if (tipo === "3d" && corpo1) {
      onImporta({ corpi: [scalaCorpo(corpo1, fattore)] }); setFatto(`Modello importato: ${descriviDimensioni(dimFinali)}.`); azzera();
    }
  }

  // ---------- PDF e immagini: scala da disegno o da misura nota, poi si ricalca l'impronta
  const mPerPxScala = tipo === "pdf" && piano?.ptPerPx && rapporto ? piano.ptPerPx * metriPerPuntoPdf(rapporto) : null;
  const pxCal = cal.length === 2 ? distanza2(cal[0] as P2, cal[1] as P2) : 0;
  const mPerPxMisura = fattoreDaMisura(pxCal, num(calReale));
  const rapportoMisurato = mPerPxMisura && piano?.ptPerPx ? mPerPxMisura / (piano.ptPerPx * metriPerPuntoPdf(1)) : null;
  const scartoScale = mPerPxScala && mPerPxMisura ? differenzaRelativa(mPerPxScala, mPerPxMisura) : null;
  const mPerPx = mPerPxMisura ?? mPerPxScala; // la misura nota, se c'è, è la più affidabile
  const improntaM: P2[] = mPerPx && poli.length >= 3 ? (() => {
    const pts = poli.map(([x, y]) => [x * mPerPx, -y * mPerPx] as P2);
    const mx = Math.min(...pts.map((p) => p[0])), my = Math.min(...pts.map((p) => p[1]));
    return pts.map((p) => [p[0] - mx, p[1] - my] as P2);
  })() : [];
  const dimPiano = improntaM.length ? [Math.max(...improntaM.map((p) => p[0])), Math.max(...improntaM.map((p) => p[1]))] : [];
  const area = improntaM.length ? Math.abs(improntaM.reduce((s, p, i) => { const q = improntaM[(i + 1) % improntaM.length] as P2; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2 : 0;

  function punto(ev: ReactMouseEvent<SVGSVGElement>): P2 | null {
    const svg = svgRef.current; const m = svg?.getScreenCTM(); if (!svg || !m) return null;
    const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const p = pt.matrixTransform(m.inverse());
    return [p.x, p.y];
  }
  function clic(ev: ReactMouseEvent<SVGSVGElement>) {
    const p = punto(ev); if (!p) return;
    if (modo === "calibra") setCal((c) => (c.length >= 2 ? [p] : [...c, p]));
    else setPoli((c) => [...c, p]);
  }
  function importaPiano() {
    const h = num(altezza);
    if (improntaM.length < 3 || !(h > 0)) return;
    const corpo = corpoSchema.parse({ id: crypto.randomUUID(), nome: (main?.name ?? "Pianta").replace(/\.[^.]+$/, ""), impronta: improntaM, quotaBase: 0, altezzaGronda: h, tipoTetto: "piano", altezzaColmo: h });
    onImporta({ corpi: [corpo] }); setFatto(`Corpo importato dalla pianta: ${descriviDimensioni(dimPiano)}, ${fmt(area, 1)} m², altezza ${fmt(h)} m.`);
    setPoli([]); setAltezza("");
  }
  const r = piano ? Math.max(piano.larghezzaPx, piano.altezzaPx) / 300 : 1; // raggio dei punti proporzionato all'immagine

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Carica un disegno o un modello: <strong>DXF</strong>, <strong>PDF</strong>, immagini di pianta (PNG, JPG), <strong>OBJ, STL, PLY, GLB/GLTF, IFC, STEP, IGES</strong>.
        Prima di importare l'app controlla la scala, ti propone quella più realistica e ti chiede di confermarla.
      </p>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-4 py-2.5 text-sm font-medium hover:border-accent">
        {busy ? "Lettura in corso…" : "Scegli file"}
        <input type="file" className="sr-only" multiple accept={ACCETTA} disabled={busy} onChange={(e) => { const l = [...(e.target.files ?? [])]; e.target.value = ""; if (l.length) void scegli(l); }} />
      </label>
      {main && <span className="ml-3 text-sm text-muted-foreground">{main.name}{files.length > 1 ? ` + ${files.length - 1} file collegati` : ""}</span>}
      {errore && <p role="alert" className="border-l-4 border-destructive pl-3 text-sm text-destructive">{errore}</p>}
      {fatto && <p role="status" className="border-l-4 border-accent pl-3 text-sm">{fatto}</p>}

      {(tipo === "dxf" || tipo === "3d") && proposta && (
        <section className="rounded-md border border-border p-4" aria-labelledby="h-scala">
          <h3 id="h-scala" className="font-display text-lg font-semibold">1. Verifica la scala</h3>
          <p className={`mt-2 border-l-4 pl-3 text-sm ${proposta.dichiarataSospetta ? "border-destructive" : "border-accent"}`}>{proposta.motivo}</p>
          {tipo === "dxf" && dxf && dxf.layers.length > 1 && (
            <div className="mt-3 max-w-xs"><Campo etichetta="Layer con l'impronta dell'edificio">
              <select className={inputCls} value={layer} onChange={(e) => setLayer(e.target.value)}>{dxf.layers.map((l) => <option key={l}>{l}</option>)}</select>
            </Campo></div>
          )}
          {tipo === "3d" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span>Asse verticale del modello:</span>
              <Button size="sm" variant={verticaleZ ? "outline" : "default"} disabled={busy} onClick={() => void cambiaAsse(false)}>Y (OBJ, glTF, IFC)</Button>
              <Button size="sm" variant={verticaleZ ? "default" : "outline"} disabled={busy} onClick={() => void cambiaAsse(true)}>Z (STEP, IGES, STL)</Button>
              <span className="text-xs text-muted-foreground">Se l'edificio risulta "sdraiato" (altezza più grande della pianta), prova l'altro asse.</span>
            </div>
          )}
          <fieldset className="mt-3">
            <legend className="text-sm font-medium">Unità del file</legend>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="border-b text-left"><th className="p-2"></th><th className="p-2">Unità</th><th className="p-2">L'edificio misurerebbe</th><th className="p-2">Esito</th></tr></thead>
                <tbody>
                  {proposta.candidati.map((c) => (
                    <tr key={c.unita} className="border-b">
                      <td className="p-2"><input type="radio" name="unita" aria-label={nomeUnita(c.unita)} checked={unita === c.unita} onChange={() => setUnita(c.unita)} /></td>
                      <td className="p-2">{nomeUnita(c.unita)}{c.unita === proposta.consigliata && <strong className="ml-2 text-accent">consigliata</strong>}{c.unita === proposta.dichiarata && <span className="ml-2 text-xs text-muted-foreground">(indicata nel file)</span>}</td>
                      <td className="p-2 font-mono">{descriviDimensioni(c.dimensioniM)}</td>
                      <td className="p-2">{c.plausibile ? "realistico" : <span className="text-destructive">non realistico</span>}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="p-2 align-top"><input type="radio" name="unita" aria-label="Da una misura nota" checked={unita === "misura"} onChange={() => setUnita("misura")} /></td>
                    <td className="p-2" colSpan={3}>
                      <span className="font-medium">Da una misura nota</span> (la verifica più sicura)
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        <select aria-label="Quale misura" className={`${inputCls} max-w-[220px]`} value={asse} onChange={(e) => { setAsse(Number(e.target.value) as 0 | 1 | 2); setUnita("misura"); }}>
                          <option value={0}>Lunghezza totale (X)</option><option value={1}>Larghezza totale (Y)</option>{tipo === "3d" && <option value={2}>Altezza totale</option>}
                        </select>
                        <input aria-label="Misura reale in metri" className={`${inputCls} max-w-[160px]`} inputMode="decimal" placeholder="metri reali" value={reale} onChange={(e) => { setReale(e.target.value); setUnita("misura"); }} />
                        <span className="pb-2 text-xs text-muted-foreground">nel file vale {fmt(dimensioniGrezze[asse] ?? 0, 3)} unità</span>
                      </div>
                      {fattoreMisura && <p className="mt-1 text-xs">Fattore ricavato: 1 unità = {fmt(fattoreMisura, 6)} m{unitaMisura ? ` → corrisponde ai ${unitaMisura.nome}` : " → nessuna unità standard: il file potrebbe essere stato scalato"}.</p>}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </fieldset>
          <h3 className="mt-4 font-display text-lg font-semibold">2. Controlla e importa</h3>
          {fattore ? (
            <p className="mt-1 text-sm">Dimensioni dopo l'importazione: <strong className="font-mono">{descriviDimensioni(dimFinali)}</strong>
              {!plausibile(dimFinali) && <span className="ml-2 text-destructive">— non sembrano quelle di un edificio: controlla l'unità.</span>}</p>
          ) : <p className="mt-1 text-sm text-muted-foreground">Scrivi la misura reale per calcolare la scala.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={!fattore || busy} onClick={importaCad}>Importa con questa scala</Button>
            <Button variant="outline" onClick={azzera}>Annulla</Button>
          </div>
        </section>
      )}

      {(tipo === "pdf" || tipo === "img") && piano && (
        <section className="rounded-md border border-border p-4" aria-labelledby="h-piano">
          <h3 id="h-piano" className="font-display text-lg font-semibold">1. Scala del disegno</h3>
          {tipo === "pdf" && (
            <div className="mt-2 space-y-2 text-sm">
              <p>Pagina {piano.pagina} di {piano.pagine}{piano.formatoMm ? `, formato ${piano.formatoMm[0]} × ${piano.formatoMm[1]} mm` : ""}.
                {piano.scalaTesto ? <> Sul disegno è scritto <strong>1:{piano.scalaTesto}</strong>.</> : <> Sul disegno non ho trovato la scala scritta.</>}</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="max-w-[200px]"><Campo etichetta="Scala del disegno">
                  <select className={inputCls} value={rapporto ?? ""} onChange={(e) => setRapporto(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Non nota</option>
                    {[...new Set([...(piano.scalaTesto ? [piano.scalaTesto] : []), ...SCALE_COMUNI])].sort((a, b) => a - b).map((s) => <option key={s} value={s}>1:{s}{s === piano.scalaTesto ? " (sul disegno)" : ""}</option>)}
                  </select>
                </Campo></div>
                {piano.pagine > 1 && <div className="max-w-[140px]"><Campo etichetta="Pagina">
                  <select className={inputCls} value={piano.pagina} onChange={(e) => { const n = Number(e.target.value); if (main) void esegui(async () => { const p = await leggiPdf(main, n); setPiano(p); setRapporto(p.scalaTesto); setCal([]); setPoli([]); }); }}>
                    {Array.from({ length: piano.pagine }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                  </select>
                </Campo></div>}
              </div>
            </div>
          )}
          <p className="mt-2 text-sm">
            <strong>Verifica con una misura nota</strong>{tipo === "img" ? " (necessaria per le immagini)" : " (consigliata: un PDF stampato ridotto, ad esempio da A3 ad A4, cambia la scala)"}:
            scegli "Misura nota", tocca i due estremi di una quota nota sul disegno e scrivi la lunghezza reale.
          </p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Button size="sm" variant={modo === "calibra" ? "default" : "outline"} onClick={() => setModo("calibra")}>Misura nota</Button>
            <Button size="sm" variant={modo === "traccia" ? "default" : "outline"} onClick={() => setModo("traccia")}>Ricalca l'impronta</Button>
            <input aria-label="Lunghezza reale della misura in metri" className={`${inputCls} max-w-[170px]`} inputMode="decimal" placeholder="lunghezza reale (m)" value={calReale} onChange={(e) => setCalReale(e.target.value)} />
            <span className="pb-2 text-xs text-muted-foreground">{cal.length < 2 ? `Punti misura: ${cal.length} di 2` : "Misura presa"}</span>
            <span className="ml-auto flex gap-1">
              <Button size="sm" variant="outline" aria-label="Riduci" onClick={() => setZoom((z) => Math.max(1, z / 1.5))}>−</Button>
              <Button size="sm" variant="outline" aria-label="Ingrandisci" onClick={() => setZoom((z) => Math.min(8, z * 1.5))}>+</Button>
            </span>
          </div>
          {(mPerPxMisura || mPerPxScala) && (
            <div className="mt-2 space-y-1 text-sm">
              {scartoScale !== null && scartoScale > 0.03 && (
                <p className="border-l-4 border-destructive pl-3">La misura nota non corrisponde alla scala 1:{rapporto} (differenza {fmt(scartoScale * 100, 0)}%): il PDF potrebbe essere stato stampato o salvato ridotto.
                  Uso la misura nota{rapportoMisurato ? `, che corrisponde a circa 1:${fmt(rapportoMisurato, 0)}${scalaComuneVicina(rapportoMisurato) ? ` (scala normale 1:${scalaComuneVicina(rapportoMisurato)})` : ""}` : ""}.</p>
              )}
              {scartoScale !== null && scartoScale <= 0.03 && <p className="border-l-4 border-accent pl-3">La misura nota conferma la scala 1:{rapporto} (differenza {fmt(scartoScale * 100, 1)}%).</p>}
              {scartoScale === null && mPerPxScala && !mPerPxMisura && <p className="border-l-4 border-accent pl-3">Uso la scala 1:{rapporto}. Ti consiglio di confermarla con una misura nota.</p>}
              {scartoScale === null && mPerPxMisura && <p className="border-l-4 border-accent pl-3">Scala ricavata dalla misura nota{rapportoMisurato ? `: circa 1:${fmt(rapportoMisurato, 0)}` : ""}.</p>}
            </div>
          )}
          <div className="mt-3 max-h-[70vh] overflow-auto rounded border border-border bg-white" style={{ touchAction: "pan-x pan-y" }}>
            <svg ref={svgRef} viewBox={`0 0 ${piano.larghezzaPx} ${piano.altezzaPx}`} style={{ width: `${zoom * 100}%`, height: "auto", display: "block", cursor: "crosshair" }}
              role="img" aria-label="Disegno importato: tocca per misurare o ricalcare" onClick={clic}>
              <image href={piano.immagine} x={0} y={0} width={piano.larghezzaPx} height={piano.altezzaPx} />
              {cal.map((p, i) => <circle key={`c${i}`} cx={p[0]} cy={p[1]} r={r} fill="#0ea5e9" />)}
              {cal.length === 2 && <line x1={cal[0]?.[0]} y1={cal[0]?.[1]} x2={cal[1]?.[0]} y2={cal[1]?.[1]} stroke="#0ea5e9" strokeWidth={r / 2} />}
              {poli.length > 1 && <polygon points={poli.map((p) => p.join(",")).join(" ")} fill="rgba(243,155,0,.25)" stroke="#f39b00" strokeWidth={r / 2} />}
              {poli.map((p, i) => <circle key={`p${i}`} cx={p[0]} cy={p[1]} r={r} fill={i === 0 ? "#c2410c" : "#f39b00"} />)}
            </svg>
          </div>
          <h3 className="mt-4 font-display text-lg font-semibold">2. Ricalca l'impronta e importa</h3>
          <p className="text-sm text-muted-foreground">Scegli "Ricalca l'impronta" e tocca gli spigoli dell'edificio uno dopo l'altro: il poligono si chiude da solo.</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Button size="sm" variant="outline" disabled={!poli.length} onClick={() => setPoli((p) => p.slice(0, -1))}>Togli l'ultimo punto</Button>
            <Button size="sm" variant="outline" disabled={!poli.length} onClick={() => setPoli([])}>Ricomincia</Button>
            <div className="max-w-[180px]"><Campo etichetta="Altezza di gronda (m)"><input className={inputCls} inputMode="decimal" value={altezza} onChange={(e) => setAltezza(e.target.value)} placeholder="es. 9" /></Campo></div>
          </div>
          {improntaM.length > 0 && (
            <p className="mt-2 text-sm">Impronta: <strong className="font-mono">{descriviDimensioni(dimPiano)}</strong>, {fmt(area, 1)} m²
              {!plausibile(dimPiano) && <span className="ml-2 text-destructive">— non sembrano le dimensioni di un edificio: controlla la scala.</span>}</p>
          )}
          {!mPerPx && <p className="mt-2 text-sm text-destructive">Manca la scala: scegli la scala del disegno o prendi una misura nota.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={improntaM.length < 3 || !(num(altezza) > 0)} onClick={importaPiano}>Importa il corpo</Button>
            <Button variant="outline" onClick={azzera}>Chiudi il disegno</Button>
          </div>
        </section>
      )}
    </div>
  );
}
