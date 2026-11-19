/**
 * Documenti dell'impianto in Word: dichiarazione di conformità D.M. 37/2008 (bozza per l'installatore),
 * verbale di prima verifica, piano delle verifiche periodiche. Dati dell'impresa e delle verifiche in `esteso.relazione`.
 */
import { useState } from "react";
import { FileCheck2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Campo, inputCls } from "@/components/Campo";
import { useDatiEdificio } from "@/lib/progettoStore";
import { aggiornaEsteso, leggiAttivo, useEsteso } from "@/lib/statoProgetto";
import { datiRelazioneVuoti, bloccoImmagine, type DatiRelazione } from "@/calcoli/relazione/relazioneTecnica";
import { dichiarazioneConformita, pianoVerifichePeriodiche, verbalePrimaVerifica, type IngressoDocumenti } from "@/calcoli/documenti/documentiImpianto";
import { creaDocx, type Documento } from "@/lib/docx";
import { scarica } from "@/lib/esportazioni";
import { Gruppo, daCompletare, logoObo } from "./RelazioneTecnica";

type Tipo = "dichiarazione" | "verbale" | "piano";
const NOMI: Record<Tipo, string> = { dichiarazione: "Dichiarazione di conformità", verbale: "Verbale di prima verifica", piano: "Piano delle verifiche" };
const FILE: Record<Tipo, string> = { dichiarazione: "Dichiarazione-conformita", verbale: "Verbale-prima-verifica", piano: "Piano-verifiche" };

export function DocumentiImpianto() {
  const d = useDatiEdificio(), s = useEsteso();
  const r: DatiRelazione = { ...datiRelazioneVuoti, ...s.relazione };
  const aggiorna = <K extends keyof DatiRelazione>(k: K, v: DatiRelazione[K]) => { setPronti({}); aggiornaEsteso({ relazione: { ...r, [k]: v } }); };
  const [aperto, setAperto] = useState(false), [occupato, setOccupato] = useState<Tipo | null>(null), [errore, setErrore] = useState("");
  const [pronti, setPronti] = useState<Partial<Record<Tipo, { blob: Blob; nome: string; mancano: string[] }>>>({});

  async function crea(tipo: Tipo) {
    setErrore(""); setOccupato(tipo);
    try {
      const logo = await logoObo();
      const x: IngressoDocumenti = {
        comune: d.comune, indirizzo: d.indirizzo, nomeProgetto: d.nomeProgetto, codice: leggiAttivo()?.codice || undefined, rev: s.revisioni.at(-1)?.rev,
        lpl: d.lplProgetto ?? s.lpl, aste: s.aste, conduttori: s.conduttori, picchetti: s.picchetti.length,
        tipoTerra: s.terra ? `tipo ${s.terra.tipo}` : undefined, dati: r, piano: s.pianoVerifiche,
        logo: logo ? bloccoImmagine(logo, 4.2, "sinistra", 3) : undefined, data: new Date(),
      };
      const doc: Documento = tipo === "dichiarazione" ? dichiarazioneConformita(x) : tipo === "verbale" ? verbalePrimaVerifica(x) : pianoVerifichePeriodiche(x);
      const base = (d.nomeProgetto || d.comune || "progetto").replace(/[^\w.-]+/g, "_");
      setPronti((p) => ({ ...p, [tipo]: { blob: new Blob([creaDocx(doc)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), nome: `${FILE[tipo]}-${base}.docx`, mancano: daCompletare(doc) } }));
    } catch (e) { setErrore(e instanceof Error ? e.message : "Documento non creato."); }
    finally { setOccupato(null); }
  }
  const testo = (k: "impresaNome" | "impresaSede" | "impresaPiva" | "impresaCciaa" | "impresaResponsabile", etichetta: string, segnaposto?: string) =>
    <Campo etichetta={etichetta}><input className={inputCls} value={r[k]} maxLength={k === "impresaPiva" ? 40 : 200} placeholder={segnaposto} onChange={(e) => aggiorna(k, e.target.value)} /></Campo>;
  const spunta = (k: "luogoDiLavoro" | "ambienteSevero", etichetta: string) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r[k]} onChange={(e) => aggiorna(k, e.target.checked)} />{etichetta}</label>;

  return <section className="mt-6 rounded-lg border p-4" aria-labelledby="h-documenti">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 id="h-documenti" className="font-display text-lg font-semibold">Documenti dell'impianto (Word)</h2>
        <p className="text-sm text-muted-foreground">Dichiarazione di conformità D.M. 37/2008 precompilata per l'impresa installatrice, verbale di prima verifica con le misure per calata e piano delle verifiche periodiche con il calendario dei prossimi 10 anni. Usano i dati del progetto e della relazione.</p></div>
      <Button type="button" variant="outline" onClick={() => setAperto(!aperto)} aria-expanded={aperto}>{aperto ? "Chiudi" : "Impresa e verifiche"}</Button>
    </div>
    {aperto && <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Gruppo titolo="Impresa installatrice">
        {testo("impresaNome", "Ragione sociale")}
        {testo("impresaResponsabile", "Titolare o legale rappresentante")}
        {testo("impresaSede", "Sede", "es. Via Roma 1, 10100 Torino")}
        {testo("impresaPiva", "Partita IVA")}
        {testo("impresaCciaa", "Iscrizione CCIAA / albo artigiani", "es. CCIAA di Torino n. …")}
      </Gruppo>
      <Gruppo titolo="Verifiche">
        <Campo etichetta="Data di messa in esercizio"><input type="date" className={inputCls} value={r.dataMessaEsercizio} onChange={(e) => aggiorna("dataMessaEsercizio", e.target.value)} /></Campo>
        <div className="grid content-end gap-2">
          {spunta("luogoDiLavoro", "Luogo di lavoro (verifiche D.P.R. 462/2001)")}
          {spunta("ambienteSevero", "Condizioni ambientali severe o ambienti a maggior rischio")}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.pianoVerifiche.critico} onChange={(e) => { setPronti({}); aggiornaEsteso({ pianoVerifiche: { ...s.pianoVerifiche, critico: e.target.checked } }); }} />Sistemi critici (verifica completa ogni anno)</label>
        </div>
      </Gruppo>
    </div>}
    <div className="mt-4 flex flex-wrap gap-2">
      {(Object.keys(NOMI) as Tipo[]).map((t) => <span key={t} className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={occupato !== null} onClick={() => void crea(t)}><FileCheck2 />{occupato === t ? "Preparazione…" : NOMI[t]}</Button>
        {pronti[t] && <Button type="button" onClick={() => scarica(pronti[t]!.blob, pronti[t]!.nome)}><Download />Scarica</Button>}
      </span>)}
    </div>
    {errore && <p role="alert" className="mt-3 text-sm text-destructive">{errore}</p>}
    {(Object.keys(pronti) as Tipo[]).map((t) => pronti[t]!.mancano.length > 0 && <p key={t} className="mt-2 text-sm text-muted-foreground"><b>{NOMI[t]}</b>, da completare: {pronti[t]!.mancano.join(" · ")}</p>)}
  </section>;
}
