/**
 * Relazione tecnica in Word sul format OBO (calcoli/relazione/relazioneTecnica.ts).
 * I dati che l'app non calcola (committente, provincia, sopralluogo…) si scrivono qui e restano nel progetto.
 */
import { useState } from "react";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { useComputo, useDatiEdificio } from "@/lib/progettoStore";
import { aggiornaEsteso, leggiAttivo, useEsteso } from "@/lib/statoProgetto";
import { leggiStato, strutturaRischio } from "@/lib/statoRischio";
import { relazioneTecnica, datiRelazioneVuoti, type DatiRelazione } from "@/calcoli/relazione/relazioneTecnica";
import { creaDocx, rasterizza, type ImmaginePdf } from "@/lib/docx";
import { trovaSchedaPdf } from "@/lib/schedeParticolari";

/** Prima pagina della scheda PDF di un particolare (archivio privato dei particolari) come PNG. */
async function schedaPng(file: string): Promise<ImmaginePdf | null> {
  const s = await trovaSchedaPdf(file);
  if (s.tipo !== "locale") return null;
  const r = await fetch(s.url); if (!r.ok) return null;
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await r.arrayBuffer()) }).promise;
  try {
    const pag = await doc.getPage(1), base = pag.getViewport({ scale: 1 });
    const vp = pag.getViewport({ scale: 1800 / Math.max(base.width, base.height) });
    const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext("2d"); if (!ctx) return null;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    await pag.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, "image/png")); if (!blob) return null;
    // al massimo 16 × 21 cm (pagina A4 con i margini)
    let w = 16, h = (16 * cv.height) / cv.width; if (h > 21) { w = (w * 21) / h; h = 21; }
    return { png: new Uint8Array(await blob.arrayBuffer()), larghezza: Math.round(w * 100) / 100, altezza: Math.round(h * 100) / 100 };
  } finally { void doc.destroy(); }
}

/** SVG → PNG a 200 dpi con il canvas del browser. */
async function svgPng(svg: string, larghezzaCm: number): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error("Grafico non disegnato.")); img.src = url; });
    const w = Math.round((larghezzaCm / 2.54) * 200), h = Math.round(w * (img.naturalHeight || img.height) / (img.naturalWidth || img.width));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d"); if (!ctx) throw new Error("Canvas non disponibile.");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, "image/png"));
    if (!blob) throw new Error("Grafico non convertito.");
    return new Uint8Array(await blob.arrayBuffer());
  } finally { URL.revokeObjectURL(url); }
}
import { scarica } from "@/lib/esportazioni";
import type { RigaComputo } from "@/calcoli/materiali/tipi";
import type { ParticolareLib } from "@/calcoli/particolari/allinea";
import type { ImmagineIn } from "@/calcoli/relazione/relazioneTecnica";
import { risorsa } from "@/lib/base";

/** Immagine pronta per Word: ridotta a `maxPx`, JPEG per le foto, PNG per loghi e stemmi. */
async function preparaImmagine(sorgente: Blob, foto: boolean, maxPx = 1600): Promise<ImmagineIn> {
  const bmp = await createImageBitmap(sorgente);
  const k = Math.min(1, maxPx / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d"); if (!ctx) throw new Error("Canvas non disponibile.");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); ctx.drawImage(bmp, 0, 0, w, h); bmp.close();
  const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, foto ? "image/jpeg" : "image/png", 0.85));
  if (!blob) throw new Error("Immagine non convertita.");
  return { dati: new Uint8Array(await blob.arrayBuffer()), jpeg: foto, larghezzaPx: w, altezzaPx: h };
}
async function logoObo(): Promise<ImmagineIn | undefined> {
  try { const r = await fetch(risorsa("relazione/logo-obo.png")); return r.ok ? await preparaImmagine(await r.blob(), false, 800) : undefined; } catch { return undefined; }
}
type Foto = { file: File; didascalia: string };

const CAMPI: { k: keyof DatiRelazione; etichetta: string; segnaposto?: string }[] = [
  { k: "titoloOpera", etichetta: "Titolo dell'opera", segnaposto: "es. Nuovo polo scientifico universitario" },
  { k: "destinazione", etichetta: "Destinazione d'uso", segnaposto: "es. attività didattiche, laboratori, uffici" },
  { k: "provincia", etichetta: "Provincia", segnaposto: "es. Torino" },
  { k: "committente", etichetta: "Committente" },
  { k: "indirizzoCommittente", etichetta: "Indirizzo del committente" },
  { k: "cittaCommittente", etichetta: "CAP e città del committente", segnaposto: "es. 10028 Trofarello (TO)" },
  { k: "luogo", etichetta: "Luogo della firma", segnaposto: "Rivoli" },
];

export function RelazioneTecnica({ righe, mancanti, particolari }: { righe: RigaComputo[]; mancanti: string[]; particolari: readonly ParticolareLib[] }) {
  const d = useDatiEdificio(), c = useComputo(), s = useEsteso();
  const r: DatiRelazione = { ...datiRelazioneVuoti, ...s.relazione };
  const [aperto, setAperto] = useState(false), [file, setFile] = useState<{ blob: Blob; nome: string } | null>(null), [errore, setErrore] = useState("");
  const cambia = (k: keyof DatiRelazione, v: string) => { setFile(null); aggiornaEsteso({ relazione: { ...r, [k]: v } }); };

  const [occupato, setOccupato] = useState(false);
  // immagini del progetto: restano solo finché la pagina è aperta (non entrano nel salvataggio del progetto)
  const [stemma, setStemma] = useState<File | null>(null), [logoComm, setLogoComm] = useState<File | null>(null), [foto, setFoto] = useState<Foto[]>([]);
  async function crea() {
    setErrore(""); setFile(null); setOccupato(true);
    try {
      let rischio = null;
      if (s.datiRischio) { const stato = leggiStato(s.datiRischio); rischio = { struttura: strutturaRischio(d, stato), zone: stato.zone }; }
      const doc = await rasterizza(relazioneTecnica({
        edificio: d, codice: leggiAttivo()?.codice || undefined, revisioni: s.revisioni, lplDisegno: s.lpl,
        modello: s.modello, aste: s.aste, conduttori: s.conduttori, picchetti: s.picchetti, terra: s.terra,
        separazione: s.separazione, rischio, risultati: c.risultati, righe, mancanti, particolari, dati: r, data: new Date(),
        immagini: {
          logo: await logoObo(),
          stemma: stemma ? await preparaImmagine(stemma, false, 800) : undefined,
          logoCommittente: logoComm ? await preparaImmagine(logoComm, false, 800) : undefined,
          foto: await Promise.all(foto.map(async (f) => ({ img: await preparaImmagine(f.file, true), didascalia: f.didascalia }))),
        },
      }), svgPng, schedaPng);
      const nome = `Relazione-LPS-${(d.nomeProgetto || d.comune || "progetto").replace(/[^\w.-]+/g, "_")}${s.revisioni.at(-1) ? `-Rev${s.revisioni.at(-1)!.rev}` : ""}.docx`;
      setFile({ blob: new Blob([creaDocx(doc)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), nome });
    } catch (e) { setErrore(e instanceof Error ? e.message : "Relazione non creata."); }
    finally { setOccupato(false); }
  }

  return <section className="mt-6 rounded-lg border p-4" aria-labelledby="h-relazione">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 id="h-relazione" className="font-display text-lg font-semibold">Relazione tecnica (Word)</h2>
        <p className="text-sm text-muted-foreground">Sul format OBO: premessa, norme 2024, valutazione del rischio con i valori calcolati, captazione, calate, separazione, terra, SPD, tipologici e elenco materiale, con grafici del progetto (rischio, sfera rotolante, pianta, separazione) e tabelle dei valori della norma. Le parti da scrivere a mano sono evidenziate in giallo.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setAperto(!aperto)} aria-expanded={aperto}>{aperto ? "Chiudi i dati" : "Dati della relazione"}</Button>
        <Button type="button" disabled={occupato} onClick={() => void crea()}><FileText />{occupato ? "Preparazione…" : "Crea relazione"}</Button>
        {file && <Button type="button" onClick={() => scarica(file.blob, file.nome)}><Download />Scarica Word</Button>}
      </div>
    </div>
    {aperto && <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {CAMPI.map((f) => <Campo key={f.k} etichetta={f.etichetta}><input className={inputCls} value={r[f.k]} maxLength={f.k === "destinazione" ? 500 : 200} placeholder={f.segnaposto} onChange={(e) => cambia(f.k, e.target.value)} /></Campo>)}
      <div className="sm:col-span-2"><Campo etichetta="Descrizione e sopralluogo (impianti e calate esistenti, componenti naturali, altezze da proteggere)"><textarea className={`${inputCls} min-h-28`} maxLength={20000} value={r.descrizione} onChange={(e) => cambia("descrizione", e.target.value)} /></Campo></div>
      <Campo etichetta="Stemma del Comune (copertina)"><input type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => { setFile(null); setStemma(e.target.files?.[0] ?? null); }} /></Campo>
      <Campo etichetta="Logo del committente (copertina)"><input type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => { setFile(null); setLogoComm(e.target.files?.[0] ?? null); }} /></Campo>
      <div className="sm:col-span-2">
        <Campo etichetta="Foto del sopralluogo e planimetrie (capitolo 11)"><input type="file" multiple accept="image/png,image/jpeg,image/webp" className="text-sm" onChange={(e) => { setFile(null); const nuove = Array.from(e.target.files ?? []).map((f) => ({ file: f, didascalia: f.name.replace(/\.[^.]+$/, "") })); setFoto((v) => [...v, ...nuove].slice(0, 30)); e.target.value = ""; }} /></Campo>
        {foto.length > 0 && <ul className="mt-2 grid gap-2">{foto.map((f, i) => <li key={i} className="flex flex-wrap items-center gap-2">
          <span className="w-40 truncate text-xs text-muted-foreground" title={f.file.name}>{f.file.name}</span>
          <input className={`${inputCls} min-w-48 flex-1`} aria-label={`Didascalia di ${f.file.name}`} value={f.didascalia} maxLength={300} onChange={(e) => { setFile(null); setFoto((v) => v.map((x, j) => (j === i ? { ...x, didascalia: e.target.value } : x))); }} />
          <Button type="button" size="sm" variant="outline" onClick={() => { setFile(null); setFoto((v) => v.filter((_, j) => j !== i)); }}>Togli</Button>
        </li>)}</ul>}
        <p className="mt-1 text-xs text-muted-foreground">Le immagini servono solo per creare il Word e non vengono salvate nel progetto: se riapri la pagina vanno scelte di nuovo.</p>
      </div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Comune, indirizzo, dimensioni e LPL vengono da Dati edificio; i valori del rischio dalla pagina Rischio; i tipologici dai particolari collegati al computo. L'attestato NG/NSG va allegato in originale.</p>
    </div>}
    {errore && <p role="alert" className="mt-3 text-sm text-destructive">{errore}</p>}
  </section>;
}
