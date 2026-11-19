/**
 * Relazione tecnica in Word sul format OBO (calcoli/relazione/relazioneTecnica.ts).
 * I dati che l'app non calcola (committente, provincia, sopralluogo…) si scrivono qui e restano nel progetto.
 */
import { useEffect, useState, type ReactNode } from "react";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { useComputo, useDatiEdificio } from "@/lib/progettoStore";
import { aggiornaEsteso, leggiAttivo, useEsteso } from "@/lib/statoProgetto";
import { leggiStato, strutturaRischio } from "@/lib/statoRischio";
import { relazioneTecnica, datiRelazioneVuoti, type DatiRelazione } from "@/calcoli/relazione/relazioneTecnica";
import { creaDocx, rasterizza, type Documento, type ImmaginePdf, type Testo } from "@/lib/docx";
import { caricaCatalogoObo, trovaArticolo } from "@/lib/catalogoObo";
import type { InfoArticolo } from "@/calcoli/relazione/testiProgetto";
import { trovaSchedaPdf } from "@/lib/schedeParticolari";
import { caricaDisegniObo, incorporaImmagini } from "@/lib/disegniObo";
import { archiviaDocumento } from "@/lib/archivioDocumenti";
import { stemmaDelComune, type ComuneTrovato, type StemmaComune } from "@/lib/stemmaComune";

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
export async function svgPng(svgIn: string, larghezzaCm: number): Promise<Uint8Array> {
  const svg = svgIn.includes("<image ") ? await incorporaImmagini(svgIn) : svgIn;
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
export async function preparaImmagine(sorgente: Blob, foto: boolean, maxPx = 1600): Promise<ImmagineIn> {
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
export async function logoObo(): Promise<ImmagineIn | undefined> {
  try { const r = await fetch(risorsa("relazione/logo-obo.png")); return r.ok ? await preparaImmagine(await r.blob(), false, 800) : undefined; } catch { return undefined; }
}
type Foto = { file: File; didascalia: string };

type ChiaveTesto = { [K in keyof DatiRelazione]: DatiRelazione[K] extends string ? K : never }[keyof DatiRelazione];
const CAMPI: { k: ChiaveTesto; etichetta: string; segnaposto?: string }[] = [
  { k: "titoloOpera", etichetta: "Titolo dell'opera", segnaposto: "es. Nuovo polo scientifico universitario" },
  { k: "destinazione", etichetta: "Destinazione d'uso", segnaposto: "es. attività didattiche, laboratori, uffici" },
  { k: "provincia", etichetta: "Provincia", segnaposto: "es. Torino" },
  { k: "committente", etichetta: "Committente" },
  { k: "indirizzoCommittente", etichetta: "Indirizzo del committente" },
  { k: "cittaCommittente", etichetta: "CAP e città del committente", segnaposto: "es. 10028 Trofarello (TO)" },
  { k: "luogo", etichetta: "Luogo della firma", segnaposto: "Rivoli" },
];
const NATURALE = [["no", "Assente"], ["si-collegato", "Presente, collegato alle calate"], ["si-da-collegare", "Presente, da collegare"], ["si-da-verificare", "Presente, collegamento da verificare"]] as const;
const SINO = [["no", "No"], ["si", "Sì"], ["da-verificare", "Da verificare"]] as const;

/** Testi evidenziati "[DA COMPLETARE …]" rimasti nella relazione. */
export function daCompletare(doc: Documento): string[] {
  const out = new Set<string>();
  const vedi = (t: Testo) => { if (typeof t !== "string") for (const r of t) if (r.daCompletare) out.add(r.t.replace(/^\[(DA COMPLETARE|TO BE COMPLETED): /, "").replace(/\]$/, "")); };
  for (const b of doc.blocchi) {
    if (b.tipo === "par") vedi(b.testo);
    else if (b.tipo === "elenco") b.voci.forEach(vedi);
    else if (b.tipo === "tabella") [b.intestazione, ...b.righe].forEach((r) => r.forEach(vedi));
    else if (b.tipo === "fascia") b.righe.forEach((r) => vedi(r.testo));
  }
  return [...out];
}

/** Nome e dati tecnici degli articoli usati per le aste (catalogo OBO dell'app). */
async function articoliAste(codici: string[]): Promise<Record<string, InfoArticolo>> {
  const cat = await caricaCatalogoObo(); const out: Record<string, InfoArticolo> = {};
  if (!cat) return out;
  for (const c of new Set(codici.filter(Boolean))) { const a = trovaArticolo(cat, c); if (a) out[c] = { nome: `${a.prodotto.nome} ${a.variante?.valori.join(" ") ?? ""}`, dati: a.prodotto.datiTecnici }; }
  return out;
}

export const Gruppo = ({ titolo, children }: { titolo: string; children: ReactNode }) => <fieldset className="grid gap-3 rounded-md border p-3 sm:col-span-2 sm:grid-cols-2"><legend className="px-1 text-sm font-semibold">{titolo}</legend>{children}</fieldset>;

export function RelazioneTecnica({ righe, mancanti, particolari }: { righe: RigaComputo[]; mancanti: string[]; particolari: readonly ParticolareLib[] }) {
  const d = useDatiEdificio(), c = useComputo(), s = useEsteso();
  const r: DatiRelazione = { ...datiRelazioneVuoti, ...s.relazione };
  const [aperto, setAperto] = useState(false), [file, setFile] = useState<{ blob: Blob; nome: string } | null>(null), [errore, setErrore] = useState(""), [mancano, setMancano] = useState<string[] | null>(null);
  const aggiorna = <K extends keyof DatiRelazione>(k: K, v: DatiRelazione[K]) => { setFile(null); aggiornaEsteso({ relazione: { ...r, [k]: v } }); };
  const cambia = (k: ChiaveTesto, v: string) => aggiorna(k, v);
  const numero = (v: string): number | null => { const x = Number(v.replace(",", ".")); return v.trim() === "" || !Number.isFinite(x) ? null : x; };
  const sel = <K extends keyof DatiRelazione>(k: K, etichetta: string, opzioni: readonly (readonly [string, string])[]) => <Campo etichetta={etichetta}><select className={inputCls} value={String(r[k])} onChange={(e) => aggiorna(k, e.target.value as DatiRelazione[K])}>{opzioni.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></Campo>;
  const num = (k: "calateNumero" | "calateInterasse" | "altezzaImpianti" | "ventoKmh" | "nsgAttestato", etichetta: string, segnaposto?: string) => <Campo etichetta={etichetta}><input className={inputCls} inputMode="decimal" value={r[k] ?? ""} placeholder={segnaposto} onChange={(e) => aggiorna(k, numero(e.target.value))} /></Campo>;
  const spunta = (k: "coperturaMetallica" | "terraCollegataAltri" | "valutazioneEconomica", etichetta: string) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r[k]} onChange={(e) => aggiorna(k, e.target.checked)} />{etichetta}</label>;
  const corpo = (id: string, campo: "altezzaDaProteggere" | "nota", v: number | string | null) => { const prima = r.corpi[id] ?? { altezzaDaProteggere: null, nota: "" }; aggiorna("corpi", { ...r.corpi, [id]: { ...prima, [campo]: v } }); };

  const [occupato, setOccupato] = useState(false);
  // immagini del progetto: restano solo finché la pagina è aperta (non entrano nel salvataggio del progetto)
  const [stemma, setStemma] = useState<File | null>(null), [logoComm, setLogoComm] = useState<File | null>(null), [foto, setFoto] = useState<Foto[]>([]);
  // stemma e provincia del Comune del progetto, cercati in automatico (Wikidata / Wikimedia Commons)
  const [auto, setAuto] = useState<{ stato: "vuoto" | "cerco" | "ok" | "nessuno" | "errore"; comune: ComuneTrovato | null; stemma: StemmaComune | null; url: string | null }>({ stato: "vuoto", comune: null, stemma: null, url: null });
  const [usaAuto, setUsaAuto] = useState(true);
  const vicino = typeof d.lat === "number" && typeof d.lon === "number" ? { lat: d.lat, lon: d.lon } : null;
  useEffect(() => {
    const nome = d.comune.trim();
    if (nome.length < 2) { setAuto({ stato: "vuoto", comune: null, stemma: null, url: null }); return; }
    const ctl = new AbortController();
    let url: string | null = null;
    const t = setTimeout(() => {
      setAuto((a) => ({ ...a, stato: "cerco" }));
      stemmaDelComune(nome, { provincia: r.provincia, vicino, segnale: ctl.signal })
        .then(({ comune, stemma: st }) => { if (st) url = URL.createObjectURL(st.blob); setAuto({ stato: comune ? "ok" : "nessuno", comune, stemma: st, url }); setFile(null); })
        .catch(() => { if (!ctl.signal.aborted) setAuto({ stato: "errore", comune: null, stemma: null, url: null }); });
    }, 700);
    return () => { clearTimeout(t); ctl.abort(); if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.comune, r.provincia, vicino?.lat, vicino?.lon]);
  const stemmaAuto = usaAuto && !stemma ? auto.stemma : null;
  async function crea() {
    setErrore(""); setFile(null); setMancano(null); setOccupato(true);
    try {
      let rischio = null;
      if (s.datiRischio) { const stato = leggiStato(s.datiRischio); rischio = { struttura: strutturaRischio(d, stato), zone: stato.zone }; }
      const doc = await rasterizza(relazioneTecnica({
        edificio: d, codice: leggiAttivo()?.codice || undefined, revisioni: s.revisioni, lplDisegno: s.lpl,
        modello: s.modello, aste: s.aste, conduttori: s.conduttori, picchetti: s.picchetti, terra: s.terra,
        separazione: s.separazione, rischio, risultati: c.risultati, righe, mancanti, particolari, dati: r, data: new Date(),
        articoli: await articoliAste(s.aste.map((a) => a.codiceOBO)),
        immagini: {
          logo: await logoObo(),
          stemma: stemma ? await preparaImmagine(stemma, false, 800) : stemmaAuto ? await preparaImmagine(stemmaAuto.blob, false, 800) : undefined,
          logoCommittente: logoComm ? await preparaImmagine(logoComm, false, 800) : undefined,
          foto: await Promise.all(foto.map(async (f) => ({ img: await preparaImmagine(f.file, true), didascalia: f.didascalia }))),
        },
        disegniObo: await caricaDisegniObo(),
        comuneUfficiale: auto.comune ? { nome: auto.comune.nome, provincia: auto.comune.provincia } : undefined,
        creditoStemma: stemmaAuto && !stemmaAuto.pubblicoDominio ? stemmaAuto.credito : undefined,
      }), svgPng, schedaPng);
      const nome = `${r.lingua === "en" ? "LPS-Report" : "Relazione-LPS"}-${(d.nomeProgetto || d.comune || "progetto").replace(/[^\w.-]+/g, "_")}${s.revisioni.at(-1) ? `-Rev${s.revisioni.at(-1)!.rev}` : ""}.docx`;
      const blob = new Blob([creaDocx(doc)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      setFile({ blob, nome }); void archiviaDocumento(blob, nome);
      setMancano(daCompletare(doc));
    } catch (e) { setErrore(e instanceof Error ? e.message : "Relazione non creata."); }
    finally { setOccupato(false); }
  }

  return <section className="mt-6 rounded-lg border p-4" aria-labelledby="h-relazione">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 id="h-relazione" className="font-display text-lg font-semibold">Relazione tecnica (Word)</h2>
        <p className="text-sm text-muted-foreground">Sul format OBO e la CEI EN IEC 62305:2026-10: premessa, norme, valutazione del rischio con i valori calcolati, captazione, calate, separazione, terra, SPD, tipologici e elenco materiale, con grafici del progetto (rischio, sfera rotolante, pianta, separazione) e tabelle dei valori della norma. I testi si adattano ai dati del progetto e del sopralluogo; quello che manca resta evidenziato in giallo.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setAperto(!aperto)} aria-expanded={aperto}>{aperto ? "Chiudi i dati" : "Dati della relazione"}</Button>
        <Button type="button" disabled={occupato} onClick={() => void crea()}><FileText />{occupato ? "Preparazione…" : "Crea relazione"}</Button>
        {file && <Button type="button" onClick={() => scarica(file.blob, file.nome)}><Download />Scarica Word</Button>}
      </div>
    </div>
    {aperto && <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Gruppo titolo="Opera e committente">
        {CAMPI.map((f) => <Campo key={f.k} etichetta={f.etichetta}><input className={inputCls} value={r[f.k]} maxLength={f.k === "destinazione" ? 500 : 200} placeholder={f.segnaposto} onChange={(e) => cambia(f.k, e.target.value)} /></Campo>)}
        {sel("lingua", "Lingua della relazione", [["it", "Italiano"], ["en", "English (traduzione automatica dei testi della relazione)"]])}
        {sel("tipoIntervento", "Tipo di intervento", [["nuovo", "Nuovo impianto"], ["adeguamento", "Adeguamento dell'impianto esistente"], ["integrazione", "Integrazione con calate, terra e SPD esistenti"]])}
        {spunta("valutazioneEconomica", "Il committente ha chiesto la valutazione economica")}
      </Gruppo>
      <Gruppo titolo="Attestato NG / NSG (CEI EN IEC 62858)">
        <Campo etichetta="Fornitore e numero dell'attestato"><input className={inputCls} value={r.ngFornitore} maxLength={200} placeholder="es. TNE srl, attestato n. …" onChange={(e) => cambia("ngFornitore", e.target.value)} /></Campo>
        <Campo etichetta="Data dell'attestato"><input className={inputCls} value={r.ngData} maxLength={200} placeholder="es. 12/09/2025" onChange={(e) => cambia("ngData", e.target.value)} /></Campo>
        {num("nsgAttestato", "NSG dall'attestato (se indicato)", `calcolato: ${(2 * d.densita).toLocaleString("it-IT")}`)}
      </Gruppo>
      <Gruppo titolo="Sopralluogo – stato di fatto">
        {sel("parapetto", "Parapetto / ringhiera metallica perimetrale", NATURALE)}
        {sel("strutturaMetallica", "Struttura metallica perimetrale (putrelle, telai)", NATURALE)}
        {sel("armature", "Ferri d'armatura elettricamente continui", SINO)}
        {spunta("coperturaMetallica", "Copertura metallica")}
        {sel("calateEsistenti", "Calate esistenti", [["nessuna", "Nessuna"], ["naturali", "Naturali (armature, strutture metalliche)"], ["in-getto", "Predisposte in getto, con uscite in copertura"], ["esterne", "Esterne esistenti"]])}
        {num("calateNumero", "Numero di calate esistenti")}
        {num("calateInterasse", "Interasse delle calate esistenti (m)")}
        {sel("terraEsistente", "Impianto di terra esistente", [["nessuno", "Nessuno / di progetto"], ["anello", "Anello (tipo B)"], ["fondazione", "Dispersore di fondazione"], ["picchetti", "Picchetti (tipo A)"], ["misto", "Anelli e picchetti"]])}
        {spunta("terraCollegataAltri", "Terra collegata agli edifici vicini")}
        {sel("spdEsistenti", "SPD esistenti sulle linee entranti", SINO)}
        <Campo etichetta="Impianti in copertura"><input className={inputCls} value={r.impiantiCopertura} maxLength={2000} placeholder="es. unità di trattamento aria, canali, pannelli FV" onChange={(e) => cambia("impiantiCopertura", e.target.value)} /></Campo>
        {num("altezzaImpianti", "Altezza massima degli impianti sul tetto (m)")}
        <div className="sm:col-span-2"><Campo etichetta="Note del sopralluogo (testo libero, aggiunto dopo lo stato di fatto)"><textarea className={`${inputCls} min-h-24`} maxLength={20000} value={r.descrizione} onChange={(e) => cambia("descrizione", e.target.value)} /></Campo></div>
      </Gruppo>
      <Gruppo titolo="Captazione">
        {sel("fissaggioAste", "Fissaggio delle aste non isolate", [["misto", "Misto / da catalogo"], ["putrella", "A putrella (struttura metallica)"], ["parapetto", "A ringhiera o parapetto"], ["treppiede", "Su treppiede con blocchi"], ["basamento", "Su basamento FangFix"], ["parete", "A parete"]])}
        {num("ventoKmh", "Velocità del vento di progetto (km/h)", "per i blocchi dei treppiedi")}
        <Campo etichetta="Distanza di sicurezza sopra l'altezza da proteggere (m)"><input className={inputCls} inputMode="decimal" value={r.margineSicurezza} onChange={(e) => aggiorna("margineSicurezza", numero(e.target.value) ?? 1)} /></Campo>
        {s.modello.corpi.length > 0 && <div className="sm:col-span-2">
          <p className="mb-1 text-sm font-medium">Altezza da proteggere sul tetto di ogni blocco (schema a blocchi)</p>
          <ul className="grid gap-2">{s.modello.corpi.map((k, i) => <li key={k.id} className="grid items-center gap-2 sm:grid-cols-[minmax(8rem,1fr)_8rem_2fr]">
            <span className="text-sm">Blocco {i + 1}{k.nome ? ` – ${k.nome}` : ""} <span className="text-muted-foreground">(H {(k.quotaBase + k.altezzaGronda).toLocaleString("it-IT")} m)</span></span>
            <input className={inputCls} inputMode="decimal" aria-label={`Altezza da proteggere, blocco ${i + 1}`} placeholder={r.altezzaImpianti != null ? String(r.altezzaImpianti) : "m"} value={r.corpi[k.id]?.altezzaDaProteggere ?? ""} onChange={(e) => corpo(k.id, "altezzaDaProteggere", numero(e.target.value))} />
            <input className={inputCls} aria-label={`Nota sul blocco ${i + 1}`} placeholder="nota per la relazione (facoltativa)" maxLength={1000} value={r.corpi[k.id]?.nota ?? ""} onChange={(e) => corpo(k.id, "nota", e.target.value)} />
          </li>)}</ul>
        </div>}
      </Gruppo>
      <Gruppo titolo="Firma">
        <Campo etichetta="Tecnico"><input className={inputCls} value={r.tecnico} maxLength={200} placeholder="es. Ing. Mario Rossi" onChange={(e) => cambia("tecnico", e.target.value)} /></Campo>
        <Campo etichetta="Iscrizione all'albo"><input className={inputCls} value={r.albo} maxLength={200} placeholder="es. Ordine degli Ingegneri di Torino n. …" onChange={(e) => cambia("albo", e.target.value)} /></Campo>
      </Gruppo>
      <Gruppo titolo="Immagini">
      <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3">
        <p className="text-sm font-medium">Stemma del Comune (copertina)</p>
        <div className="mt-2 flex flex-wrap items-start gap-3">
          {auto.url && !stemma && <img src={auto.url} alt={`Stemma del Comune di ${auto.comune?.nome ?? ""}`} className={`h-20 w-auto rounded border bg-white p-1 ${usaAuto ? "" : "opacity-40"}`} />}
          <div className="grid flex-1 gap-1 text-sm">
            {auto.stato === "vuoto" && <span className="text-muted-foreground">Indica il Comune nei dati dell'edificio: stemma e provincia si cercano da soli.</span>}
            {auto.stato === "cerco" && <span className="text-muted-foreground">Cerco lo stemma di {d.comune}…</span>}
            {auto.stato === "nessuno" && <span className="text-muted-foreground">Nessun Comune italiano trovato per «{d.comune}»: controlla il nome o carica lo stemma.</span>}
            {auto.stato === "errore" && <span className="text-muted-foreground">Servizio dello stemma non raggiungibile: si può caricare a mano.</span>}
            {auto.stato === "ok" && auto.comune && <>
              <span>Comune di <b>{auto.comune.nome}</b>{auto.comune.provincia ? <> · provincia di <b>{auto.comune.provincia}</b>{!r.provincia && " (usata in copertina)"}</> : null}</span>
              {auto.stemma
                ? <><label className="flex items-center gap-2"><input type="checkbox" checked={usaAuto} disabled={!!stemma} onChange={(e) => { setFile(null); setUsaAuto(e.target.checked); }} />Usa questo stemma in copertina</label>
                  <span className="text-xs text-muted-foreground">Da <a className="underline" href={auto.stemma.pagina} target="_blank" rel="noreferrer">Wikimedia Commons</a>{auto.stemma.pubblicoDominio ? " (pubblico dominio)" : ": autore e licenza vengono riportati negli allegati della relazione"}.</span></>
                : <span className="text-muted-foreground">Stemma non presente su Wikidata: si può caricare a mano.</span>}
            </>}
            <label className="mt-1 text-xs text-muted-foreground">Oppure carica uno stemma (ha la precedenza)
              <input type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block text-sm" onChange={(e) => { setFile(null); setStemma(e.target.files?.[0] ?? null); }} />
            </label>
          </div>
        </div>
      </div>
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
      </Gruppo>
      <p className="text-xs text-muted-foreground sm:col-span-2">Comune, indirizzo, dimensioni e LPL vengono da Dati edificio; blocchi, aste e calate da Edificio 3D; i valori del rischio dalla pagina Rischio; i tipologici dai particolari collegati al computo. L'attestato NG/NSG va allegato in originale.</p>
    </div>}
    {mancano && (mancano.length === 0
      ? <p role="status" className="mt-3 text-sm">Relazione completa: nessuna parte da completare.</p>
      : <div role="status" className="mt-3 rounded-md border border-accent bg-secondary p-3 text-sm"><p className="font-semibold">{mancano.length} {mancano.length === 1 ? "parte resta" : "parti restano"} da completare (evidenziate in giallo nel Word):</p><ul className="mt-1 list-disc pl-5">{mancano.map((m) => <li key={m}>{m}</li>)}</ul></div>)}
    {errore && <p role="alert" className="mt-3 text-sm text-destructive">{errore}</p>}
  </section>;
}
