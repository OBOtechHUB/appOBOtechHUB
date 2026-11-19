/**
 * Sopralluogo da tablet o telefono: foto con didascalia (anche senza rete, caricate quando torna),
 * stato di fatto, misure per calata, checklist e SPD del verbale di prima verifica, esito e firma sul dispositivo.
 * Tutto si salva nel progetto attivo (`esteso.sopralluogo` e `esteso.relazione`) e va in relazione e nel verbale.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, ImagePlus, CloudUpload, FileCheck2, Download, WifiOff, Wifi, Plus, Eraser, Gauge, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampoNumero } from "@/components/CampoNumero";
import { PageTitle } from "@/components/PageTitle";
import { useDatiEdificio } from "@/lib/progettoStore";
import { aggiornaEsteso, leggiAttivo, leggiEsteso, useAttivo, useEsteso, sopralluogoSchema, type Sopralluogo } from "@/lib/statoProgetto";
import { datiRelazioneVuoti, bloccoImmagine, type DatiRelazione } from "@/calcoli/relazione/relazioneTecnica";
import { CHECKLIST } from "@/calcoli/verifiche/verifiche";
import { verbalePrimaVerifica, type IngressoDocumenti } from "@/calcoli/documenti/documentiImpianto";
import { creaDocx } from "@/lib/docx";
import { scarica } from "@/lib/esportazioni";
import { archiviaDocumento } from "@/lib/archivioDocumenti";
import { fotoInCoda, percorsoFoto, riduciFoto, salvaFoto, scaricaFoto, sincronizzaFoto } from "@/lib/fotoSopralluogo";
import { logoObo, preparaImmagine } from "@/components/progetto/RelazioneTecnica";
import { leggiDisplay, letturaDisponibile, type ValoreLetto } from "@/lib/letturaDisplay";

const cls = "h-11 w-full rounded-md border border-input bg-background px-3 text-base";
const vuoto = (): Sopralluogo => sopralluogoSchema.parse({});

function Sezione({ titolo, aperta, children }: { titolo: string; aperta?: boolean; children: ReactNode }) {
  return <details open={aperta} className="group rounded-lg border bg-card"><summary className="cursor-pointer select-none px-4 py-3 text-lg font-semibold marker:text-accent">{titolo}</summary><div className="space-y-3 px-4 pb-4">{children}</div></details>;
}
function Etichetta({ testo, children }: { testo: string; children: ReactNode }) { return <label className="block text-sm"><span className="mb-1 block font-medium">{testo}</span>{children}</label>; }

export function SopralluogoPage() {
  const d = useDatiEdificio(), s = useEsteso(), attivo = useAttivo();
  const so: Sopralluogo = { ...vuoto(), ...s.sopralluogo };
  const r: DatiRelazione = { ...datiRelazioneVuoti, ...s.relazione };
  const leggiSo = (): Sopralluogo => ({ ...vuoto(), ...leggiEsteso().sopralluogo });
  const setSo = (p: Partial<Sopralluogo>) => aggiornaEsteso({ sopralluogo: { ...leggiSo(), ...p } });
  const setR = <K extends keyof DatiRelazione>(k: K, v: DatiRelazione[K]) => aggiornaEsteso({ relazione: { ...r, [k]: v } });
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine), [inCoda, setInCoda] = useState(0), [msg, setMsg] = useState(""), [occupato, setOccupato] = useState(false);
  const [anteprime, setAnteprime] = useState<Record<string, string>>({}), [verbale, setVerbale] = useState<{ blob: Blob; nome: string } | null>(null);
  const fotoRef = useRef<HTMLInputElement>(null), galleriaRef = useRef<HTMLInputElement>(null);
  const [guidata, setGuidata] = useState<number | null>(null);

  const aggiornaCoda = () => void fotoInCoda().then((c) => setInCoda(c.length));
  useEffect(() => {
    const su = () => { setOnline(true); void sincronizzaFoto().then(setInCoda); }, giu = () => setOnline(false);
    window.addEventListener("online", su); window.addEventListener("offline", giu); aggiornaCoda();
    if (navigator.onLine) void sincronizzaFoto().then(setInCoda);
    return () => { window.removeEventListener("online", su); window.removeEventListener("offline", giu); };
  }, []);
  // anteprime delle foto (copia locale o server)
  useEffect(() => {
    let vivo = true; const nuove: Record<string, string> = {};
    void (async () => { for (const f of so.foto) if (!anteprime[f.percorso]) { const b = await scaricaFoto(f.percorso); if (b) nuove[f.percorso] = URL.createObjectURL(b); }
      if (vivo && Object.keys(nuove).length) setAnteprime((a) => ({ ...a, ...nuove })); })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [so.foto.length]);

  /** salva una foto di misura (calata e grandezza) e restituisce l'immagine per la lettura del display */
  async function fotoMisura(file: File, calata: string, misura: "continuita" | "terra" | "terra-totale"): Promise<Blob | null> {
    const a = leggiAttivo(); if (!a) return null;
    const percorso = await percorsoFoto(a.id); if (!percorso) { setMsg("Accedi per salvare le foto."); return null; }
    const blob = await riduciFoto(file); const esito = await salvaFoto(percorso, blob);
    setAnteprime((x) => ({ ...x, [percorso]: URL.createObjectURL(blob) }));
    const nome = misura === "continuita" ? "continuità" : misura === "terra" ? "resistenza di terra" : "terra a giunti chiusi";
    aggiornaEsteso({ sopralluogo: { ...leggiSo(), foto: [...leggiSo().foto, { id: percorso.split("/").pop()!, percorso, didascalia: `${calata ? `Calata ${calata} – ` : ""}${nome}`, data: new Date().toISOString(), lat: null, lon: null, inRelazione: false, calata, misura }].slice(0, 120) } });
    if (esito === "in-coda") setMsg("Senza rete: le foto restano sul dispositivo e si caricano da sole quando torna la connessione.");
    aggiornaCoda(); return blob;
  }
  async function aggiungiFoto(files: FileList | null) {
    const a = leggiAttivo(); if (!files?.length || !a) return;
    setOccupato(true); setMsg("");
    try {
      const nuove: Sopralluogo["foto"] = [];
      for (const f of Array.from(files).slice(0, 20)) {
        const percorso = await percorsoFoto(a.id); if (!percorso) { setMsg("Accedi per salvare le foto."); break; }
        const blob = await riduciFoto(f); const esito = await salvaFoto(percorso, blob);
        setAnteprime((x) => ({ ...x, [percorso]: URL.createObjectURL(blob) }));
        nuove.push({ id: percorso.split("/").pop()!, percorso, didascalia: "", data: new Date().toISOString(), lat: null, lon: null, inRelazione: true, calata: "", misura: "" });
        if (esito === "in-coda") setMsg("Senza rete: le foto restano sul dispositivo e si caricano da sole quando torna la connessione.");
      }
      if (nuove.length) setSo({ foto: [...leggiSo().foto, ...nuove].slice(0, 120) });
    } finally { setOccupato(false); aggiornaCoda(); if (fotoRef.current) fotoRef.current.value = ""; if (galleriaRef.current) galleriaRef.current.value = ""; }
  }
  const prepCalate = () => {
    const disegnate = s.conduttori.filter((c) => c.tipo === "calata").length, n = Math.max(disegnate, r.calateNumero ?? 0, 2);
    setSo({ calate: Array.from({ length: n }, (_, i) => so.calate[i] ?? { nome: `C${i + 1}`, continuita: null, resistenza: null, giunto: null, note: "" }) });
  };
  const setCalata = (i: number, p: Partial<Sopralluogo["calate"][number]>) => setSo({ calate: leggiSo().calate.map((c, k) => (k === i ? { ...c, ...p } : c)) });
  const setSpd = (i: number, p: Partial<Sopralluogo["spd"][number]>) => setSo({ spd: leggiSo().spd.map((c, k) => (k === i ? { ...c, ...p } : c)) });

  async function creaVerbale() {
    setOccupato(true); setMsg("");
    try {
      const logo = await logoObo();
      const firma = so.firma ? await preparaImmagine(await (await fetch(so.firma)).blob(), false, 900) : null;
      const foto = (await Promise.all(so.foto.map(async (f) => { const b = await scaricaFoto(f.percorso); return b ? { img: bloccoImmagine(await preparaImmagine(b, true), 12, "centro", 9), didascalia: f.didascalia } : null; }))).filter((x): x is { img: ReturnType<typeof bloccoImmagine>; didascalia: string } => !!x);
      const x: IngressoDocumenti = {
        comune: d.comune, indirizzo: d.indirizzo, nomeProgetto: d.nomeProgetto, codice: leggiAttivo()?.codice || undefined, rev: s.revisioni.at(-1)?.rev,
        lpl: d.lplProgetto ?? s.lpl, aste: s.aste, conduttori: s.conduttori, picchetti: s.picchetti.length, tipoTerra: s.terra ? `tipo ${s.terra.tipo}` : undefined,
        dati: r, piano: s.pianoVerifiche, logo: logo ? bloccoImmagine(logo, 4.2, "sinistra", 3) : undefined, data: new Date(),
        sopralluogo: so, firmaVerificatore: firma ? bloccoImmagine(firma, 5, "destra", 2.5) : undefined, fotoSopralluogo: foto,
      };
      const blob = new Blob([creaDocx(verbalePrimaVerifica(x))], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      const nome = `Verbale-prima-verifica-${(d.nomeProgetto || d.comune || "progetto").replace(/[^\w.-]+/g, "_")}.docx`;
      setVerbale({ blob, nome }); void archiviaDocumento(blob, nome);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Verbale non creato."); }
    finally { setOccupato(false); }
  }

  if (!attivo) return <main className="mx-auto max-w-3xl px-4 py-8"><PageTitle titolo="Sopralluogo" /><p className="mt-4 text-muted-foreground">Apri prima un progetto salvato (Progetti): il sopralluogo si salva nel progetto.</p></main>;
  const nCompilate = Object.keys(so.esiti).length;
  return <main className="mx-auto max-w-3xl space-y-4 px-4 py-6">
    <PageTitle titolo="Sopralluogo" />
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">{d.nomeProgetto || "Progetto"}{d.comune ? ` – ${d.comune}` : ""}</span>
      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 ${online ? "bg-green-600/15" : "bg-amber-500/20"}`}>{online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}{online ? "In linea" : "Senza rete: i dati restano sul dispositivo"}</span>
      {inCoda > 0 && <Button type="button" size="sm" variant="outline" onClick={() => void sincronizzaFoto().then(setInCoda)}><CloudUpload />{inCoda} foto da caricare</Button>}
    </div>
    {msg && <p role="status" className="text-sm">{msg}</p>}

    <Sezione titolo={`Foto (${so.foto.length})`} aperta>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" className="h-14 whitespace-normal px-2 text-base leading-tight" disabled={occupato} onClick={() => fotoRef.current?.click()}><Camera />Scatta foto</Button>
        <Button type="button" variant="outline" className="h-14 whitespace-normal px-2 text-base leading-tight" disabled={occupato} onClick={() => galleriaRef.current?.click()}><ImagePlus />Dalla galleria</Button>
      </div>
      <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void aggiungiFoto(e.target.files)} />
      <input ref={galleriaRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void aggiungiFoto(e.target.files)} />
      <ul className="grid gap-3 sm:grid-cols-2">{so.foto.map((f, i) => <li key={f.id} className="rounded-md border p-2">
        {anteprime[f.percorso] ? <img src={anteprime[f.percorso]} alt={f.didascalia || `Foto ${i + 1}`} className="aspect-[4/3] w-full rounded object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center rounded bg-muted text-sm text-muted-foreground">Foto {i + 1}</div>}
        <input className={`${cls} mt-2`} value={f.didascalia} maxLength={300} placeholder="Didascalia (es. Copertura lato nord)" aria-label={`Didascalia foto ${i + 1}`} onChange={(e) => setSo({ foto: so.foto.map((x) => (x.id === f.id ? { ...x, didascalia: e.target.value } : x)) })} />
        <label className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={f.inRelazione} onChange={(e) => setSo({ foto: so.foto.map((x) => (x.id === f.id ? { ...x, inRelazione: e.target.checked } : x)) })} />Nella relazione</label>
      </li>)}</ul>
    </Sezione>

    <Sezione titolo="Stato di fatto">
      {([["parapetto", "Parapetto / ringhiera metallica", [["no", "Assente"], ["si-collegato", "Presente, collegato alle calate"], ["si-da-collegare", "Presente, da collegare"], ["si-da-verificare", "Presente, da verificare"]]],
        ["strutturaMetallica", "Struttura metallica perimetrale", [["no", "Assente"], ["si-collegato", "Presente, collegata"], ["si-da-collegare", "Presente, da collegare"], ["si-da-verificare", "Presente, da verificare"]]],
        ["armature", "Ferri d'armatura continui", [["no", "No"], ["si", "Sì"], ["da-verificare", "Da verificare"]]],
        ["calateEsistenti", "Calate esistenti", [["nessuna", "Nessuna"], ["naturali", "Naturali"], ["in-getto", "Predisposte nel getto"], ["esterne", "Esterne"]]],
        ["terraEsistente", "Impianto di terra esistente", [["nessuno", "Nessuno / non noto"], ["anello", "Anello"], ["fondazione", "Fondazione"], ["picchetti", "Picchetti"], ["misto", "Anello e picchetti"]]],
        ["spdEsistenti", "SPD sulle linee entranti", [["no", "No"], ["si", "Sì"], ["da-verificare", "Da verificare"]]],
      ] as const).map(([k, t, opz]) => <Etichetta key={k} testo={t}><select className={cls} value={String(r[k])} onChange={(e) => setR(k, e.target.value as never)}>{opz.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Etichetta>)}
      <div className="grid grid-cols-2 gap-2">
        <Etichetta testo="N° calate esistenti"><CampoNumero className={cls} inputMode="numeric" valore={r.calateNumero} onValore={(v) => setR("calateNumero", v == null ? null : Math.round(v))} min={0} max={500} /></Etichetta>
        <Etichetta testo="Interasse calate (m)"><CampoNumero className={cls} valore={r.calateInterasse} onValore={(v) => setR("calateInterasse", v)} min={0} /></Etichetta>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={r.terraCollegataAltri} onChange={(e) => setR("terraCollegataAltri", e.target.checked)} />Terra collegata agli edifici vicini</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={r.coperturaMetallica} onChange={(e) => setR("coperturaMetallica", e.target.checked)} />Copertura metallica</label>
      <Etichetta testo="Impianti in copertura"><input className={cls} value={r.impiantiCopertura} maxLength={500} placeholder="es. UTA, pannelli fotovoltaici, antenne" onChange={(e) => setR("impiantiCopertura", e.target.value)} /></Etichetta>
      <Etichetta testo="Altezza massima degli impianti (m)"><CampoNumero className={cls} valore={r.altezzaImpianti} onValore={(v) => setR("altezzaImpianti", v)} min={0} /></Etichetta>
    </Sezione>

    <Sezione titolo="Misure per calata">
      <div className="grid grid-cols-2 gap-2">
        <Etichetta testo="Data della verifica"><input type="date" className={cls} value={so.dataVerifica} onChange={(e) => setSo({ dataVerifica: e.target.value })} /></Etichetta>
        <Etichetta testo="Verificatore"><input className={cls} value={so.verificatore} maxLength={200} onChange={(e) => setSo({ verificatore: e.target.value })} /></Etichetta>
        <Etichetta testo="Strumenti (modello e matricola)"><input className={cls} value={so.strumenti} maxLength={300} onChange={(e) => setSo({ strumenti: e.target.value })} /></Etichetta>
        <Etichetta testo="Condizioni del terreno"><input className={cls} value={so.condizioni} maxLength={200} placeholder="asciutto, 12 °C" onChange={(e) => setSo({ condizioni: e.target.value })} /></Etichetta>
      </div>
      {!so.calate.length && <Button type="button" variant="outline" onClick={prepCalate}><Plus />Prepara le calate del progetto</Button>}
      {so.calate.length > 0 && <Button type="button" className="h-12 w-full text-base" onClick={() => setGuidata(Math.max(0, so.calate.findIndex((c) => c.continuita == null || c.resistenza == null)))}><Gauge />Misura guidata con foto dello strumento</Button>}
      <ul className="space-y-2">{so.calate.map((c, i) => <li key={i} className="rounded-md border p-3">
        <div className="grid grid-cols-[4.5rem_1fr_1fr] items-end gap-2">
          <Etichetta testo="Calata"><input className={cls} value={c.nome} maxLength={20} onChange={(e) => setCalata(i, { nome: e.target.value })} /></Etichetta>
          <Etichetta testo="Continuità (Ω)"><CampoNumero className={cls} valore={c.continuita} onValore={(v) => setCalata(i, { continuita: v })} min={0} /></Etichetta>
          <Etichetta testo="Terra (Ω)"><CampoNumero className={cls} valore={c.resistenza} onValore={(v) => setCalata(i, { resistenza: v })} min={0} /></Etichetta>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span>Giunto accessibile:</span>
          {([[true, "Sì"], [false, "No"]] as const).map(([v, t]) => <Button key={t} type="button" size="sm" variant={c.giunto === v ? "default" : "outline"} aria-pressed={c.giunto === v} onClick={() => setCalata(i, { giunto: c.giunto === v ? null : v })}>{t}</Button>)}
          <input className={`${cls} h-9 flex-1`} value={c.note} maxLength={300} placeholder="Note" aria-label={`Note calata ${c.nome}`} onChange={(e) => setCalata(i, { note: e.target.value })} /></div>
      </li>)}</ul>
      {so.calate.length > 0 && <Button type="button" size="sm" variant="outline" onClick={() => setSo({ calate: [...so.calate, { nome: `C${so.calate.length + 1}`, continuita: null, resistenza: null, giunto: null, note: "" }] })}><Plus />Aggiungi calata</Button>}
      <div className="grid grid-cols-2 gap-2">
        <Etichetta testo="Terra a giunti chiusi (Ω)"><CampoNumero className={cls} valore={so.resistenzaTotale} onValore={(v) => setSo({ resistenzaTotale: v })} min={0} /></Etichetta>
        <Etichetta testo="Metodo di misura"><input className={cls} value={so.metodo} maxLength={100} placeholder="voltamperometrico, a pinza…" onChange={(e) => setSo({ metodo: e.target.value })} /></Etichetta>
      </div>
    </Sezione>

    <Sezione titolo={`Esame a vista e prove (${nCompilate}/${CHECKLIST.length})`}>
      {[...new Set(CHECKLIST.map((v) => v.sezione))].map((sez) => <div key={sez}><p className="mt-2 text-sm font-semibold text-muted-foreground">{sez}</p>
        <ul className="divide-y">{CHECKLIST.filter((v) => v.sezione === sez).map((v) => { const e = so.esiti[v.id]; return <li key={v.id} className="py-2">
          <p className="text-sm">{v.testo}</p>
          <div className="mt-1 flex flex-wrap gap-1">{(["C", "NC", "NA"] as const).map((k) => <Button key={k} type="button" size="sm" className="min-w-12" variant={e?.esito === k ? (k === "NC" ? "destructive" : "default") : "outline"} aria-pressed={e?.esito === k} onClick={() => { const es = { ...so.esiti }; if (e?.esito === k) delete es[v.id]; else es[v.id] = { esito: k, nota: e?.nota ?? "" }; setSo({ esiti: es }); }}>{k}</Button>)}
            {e && <input className={`${cls} h-9 flex-1`} value={e.nota} maxLength={300} placeholder="Nota" aria-label={`Nota: ${v.testo}`} onChange={(ev) => setSo({ esiti: { ...so.esiti, [v.id]: { ...e, nota: ev.target.value } } })} />}</div>
        </li>; })}</ul></div>)}
    </Sezione>

    <Sezione titolo="SPD">
      <ul className="space-y-2">{so.spd.map((x, i) => <li key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
        <Etichetta testo="Quadro / linea"><input className={cls} value={x.quadro} maxLength={100} onChange={(e) => setSpd(i, { quadro: e.target.value })} /></Etichetta>
        <Etichetta testo="Tipo e codice OBO"><input className={cls} value={x.tipo} maxLength={100} onChange={(e) => setSpd(i, { tipo: e.target.value })} /></Etichetta>
        <div className="flex flex-wrap items-center gap-1 text-sm"><span className="mr-1">Indicatore:</span>{([[true, "Ok"], [false, "Guasto"]] as const).map(([v, t]) => <Button key={t} type="button" size="sm" variant={x.indicatoreOk === v ? "default" : "outline"} onClick={() => setSpd(i, { indicatoreOk: x.indicatoreOk === v ? null : v })}>{t}</Button>)}</div>
        <div className="flex flex-wrap items-center gap-1 text-sm"><span className="mr-1">Collegamento:</span>{([[true, "Ok"], [false, "No"]] as const).map(([v, t]) => <Button key={t} type="button" size="sm" variant={x.collegatoOk === v ? "default" : "outline"} onClick={() => setSpd(i, { collegatoOk: x.collegatoOk === v ? null : v })}>{t}</Button>)}</div>
      </li>)}</ul>
      <Button type="button" size="sm" variant="outline" onClick={() => setSo({ spd: [...so.spd, { quadro: "", tipo: "", indicatoreOk: null, collegatoOk: null }] })}><Plus />Aggiungi SPD</Button>
    </Sezione>

    <Sezione titolo="Esito e firma">
      <div className="grid grid-cols-2 gap-2">{([["conforme", "Conforme"], ["non-conforme", "Non conforme"]] as const).map(([v, t]) => <Button key={v} type="button" className="h-12 whitespace-normal px-2 leading-tight" variant={so.esitoFinale === v ? (v === "conforme" ? "default" : "destructive") : "outline"} aria-pressed={so.esitoFinale === v} onClick={() => setSo({ esitoFinale: so.esitoFinale === v ? "" : v })}>{t}</Button>)}</div>
      <Etichetta testo="Note e prescrizioni"><textarea className={`${cls} h-24 py-2`} value={so.note} maxLength={3000} onChange={(e) => setSo({ note: e.target.value })} /></Etichetta>
      <Firma valore={so.firma} onFirma={(firma) => setSo({ firma, firmatoIl: firma ? new Date().toISOString() : "" })} />
    </Sezione>

    {guidata !== null && so.calate[guidata] && <MisuraGuidata indice={guidata} totale={so.calate.length} calata={so.calate[guidata]!} anteprime={anteprime}
      foto={so.foto.filter((f) => f.calata === so.calate[guidata]!.nome)}
      onCambia={(p) => setCalata(guidata, p)} onFoto={(file, misura) => fotoMisura(file, so.calate[guidata]!.nome, misura)}
      onVai={(i) => setGuidata(i < 0 || i >= so.calate.length ? null : i)} />}

    {guidata === null && <div className="sticky bottom-0 -mx-4 flex flex-wrap gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
      <Button type="button" className="h-12 flex-1" disabled={occupato} onClick={() => void creaVerbale()}><FileCheck2 />{occupato ? "Preparazione…" : "Crea verbale"}</Button>
      {verbale && <Button type="button" variant="outline" className="h-12" onClick={() => scarica(verbale.blob, verbale.nome)}><Download />Scarica</Button>}
    </div>}
  </main>;
}

/** Firma con il dito o la penna; si salva come immagine PNG nel progetto. */
function Firma({ valore, onFirma }: { valore: string; onFirma: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null), disegno = useRef(false), [toccata, setToccata] = useState(false);
  useEffect(() => {
    const c = ref.current; if (!c) return; const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    if (valore) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, c.width, c.height); im.src = valore; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const c = ref.current!, b = c.getBoundingClientRect(); return [((e.clientX - b.left) * c.width) / b.width, ((e.clientY - b.top) * c.height) / b.height] as const; };
  return <div>
    <p className="mb-1 text-sm font-medium">Firma del verificatore</p>
    <canvas ref={ref} width={900} height={300} className="h-36 w-full touch-none rounded-md border bg-white" aria-label="Area per la firma"
      onPointerDown={(e) => { disegno.current = true; (e.target as Element).setPointerCapture(e.pointerId); const ctx = ref.current!.getContext("2d")!; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.strokeStyle = "#1d2b44"; }}
      onPointerMove={(e) => { if (!disegno.current) return; const ctx = ref.current!.getContext("2d")!; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); setToccata(true); }}
      onPointerUp={() => { disegno.current = false; }} />
    <div className="mt-2 flex gap-2">
      <Button type="button" size="sm" disabled={!toccata} onClick={() => { onFirma(ref.current!.toDataURL("image/png")); setToccata(false); }}>Salva firma</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => { const c = ref.current!, ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); setToccata(false); }}><Eraser />Rifai</Button>
      {valore && <span className="self-center text-xs text-muted-foreground">Firma salvata</span>}
    </div>
  </div>;
}

/** Misura guidata a schermo intero: per ogni calata indica cosa misurare, fa la foto dello strumento,
 *  propone i valori letti dal display (dove il browser lo permette) e salva. */
function MisuraGuidata({ indice, totale, calata, foto, anteprime, onCambia, onFoto, onVai }: {
  indice: number; totale: number; calata: Sopralluogo["calate"][number]; foto: Sopralluogo["foto"]; anteprime: Record<string, string>;
  onCambia: (p: Partial<Sopralluogo["calate"][number]>) => void; onFoto: (f: File, m: "continuita" | "terra") => Promise<Blob | null>; onVai: (i: number) => void;
}) {
  const [letti, setLetti] = useState<Partial<Record<"continuita" | "terra", ValoreLetto[] | "lettura" | "nessuno">>>({});
  const refs = { continuita: useRef<HTMLInputElement>(null), terra: useRef<HTMLInputElement>(null) };
  useEffect(() => { setLetti({}); }, [indice]);
  async function scatta(m: "continuita" | "terra", files: FileList | null) {
    const f = files?.[0]; if (!f) return;
    setLetti((x) => ({ ...x, [m]: "lettura" }));
    const blob = await onFoto(f, m); const v = blob ? await leggiDisplay(blob) : null;
    setLetti((x) => ({ ...x, [m]: v && v.length ? v : "nessuno" }));
    if (v?.length === 1) onCambia(m === "continuita" ? { continuita: v[0]!.valore } : { resistenza: v[0]!.valore });
    if (refs[m].current) refs[m].current.value = "";
  }
  const passo = (m: "continuita" | "terra", titolo: string, istruzione: string) => {
    const valore = m === "continuita" ? calata.continuita : calata.resistenza, l = letti[m], ultima = foto.filter((x) => x.misura === m).at(-1);
    return <section className="rounded-lg border p-3">
      <h3 className="text-base font-semibold">{titolo}</h3>
      <p className="text-sm text-muted-foreground">{istruzione}</p>
      <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
        <label className="block text-sm"><span className="mb-1 block font-medium">Valore (Ω)</span>
          <CampoNumero className="h-14 w-full rounded-md border border-input bg-background px-3 text-2xl tabular-nums" valore={valore} min={0} onValore={(v) => onCambia(m === "continuita" ? { continuita: v } : { resistenza: v })} /></label>
        <Button type="button" className="h-14" onClick={() => refs[m].current?.click()}><Camera />Foto</Button>
      </div>
      <input ref={refs[m]} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void scatta(m, e.target.files)} />
      {l === "lettura" && <p role="status" className="mt-2 text-sm">Lettura del display…</p>}
      {Array.isArray(l) && <div className="mt-2 flex flex-wrap items-center gap-2 text-sm"><span>Letti dalla foto:</span>{l.map((x) => <Button key={x.testo} type="button" size="sm" variant={valore === x.valore ? "default" : "outline"} onClick={() => onCambia(m === "continuita" ? { continuita: x.valore } : { resistenza: x.valore })}>{x.testo}</Button>)}</div>}
      {l === "nessuno" && <p className="mt-2 text-sm text-muted-foreground">{letturaDisponibile() ? "Valore non riconosciuto: scrivilo guardando la foto." : "Questo browser non legge il display: scrivi il valore guardando la foto (la foto resta come prova)."}</p>}
      {ultima && anteprime[ultima.percorso] && <img src={anteprime[ultima.percorso]} alt={ultima.didascalia} className="mt-2 max-h-56 w-full rounded object-contain" />}
    </section>;
  };
  return <div className="fixed inset-0 z-[70] flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`Misura della calata ${calata.nome}`}>
    <header className="flex items-center justify-between border-b px-4 py-3">
      <div><p className="text-lg font-semibold">Calata {calata.nome}</p><p className="text-xs text-muted-foreground">{indice + 1} di {totale}</p></div>
      <Button type="button" variant="ghost" onClick={() => onVai(-1)} aria-label="Chiudi"><X /></Button>
    </header>
    <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
      {passo("continuita", "1. Continuità", "Con il giunto di sezionamento chiuso, misura la continuità tra la captazione e il giunto della calata.")}
      {passo("terra", "2. Resistenza di terra", "Apri il giunto e misura la resistenza del dispersore della calata (dispersori di tipo A).")}
      <section className="rounded-lg border p-3"><h3 className="text-base font-semibold">3. Giunto e note</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">{([[true, "Giunto accessibile"], [false, "Non accessibile"]] as const).map(([v, t]) => <Button key={t} type="button" className="h-12 whitespace-normal px-2 leading-tight" variant={calata.giunto === v ? "default" : "outline"} aria-pressed={calata.giunto === v} onClick={() => onCambia({ giunto: calata.giunto === v ? null : v })}>{t}</Button>)}</div>
        <input className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-base" value={calata.note} maxLength={300} placeholder="Note (es. giunto coperto, ossidazione)" aria-label="Note" onChange={(e) => onCambia({ note: e.target.value })} />
      </section>
    </div>
    <footer className="grid grid-cols-2 gap-2 border-t px-4 py-3">
      <Button type="button" variant="outline" className="h-12" disabled={indice === 0} onClick={() => onVai(indice - 1)}><ChevronLeft />Precedente</Button>
      <Button type="button" className="h-12" onClick={() => onVai(indice + 1 < totale ? indice + 1 : -1)}>{indice + 1 < totale ? <>Salva e avanti<ChevronRight /></> : "Fine"}</Button>
    </footer>
  </div>;
}
