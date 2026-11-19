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
import { creaDocx } from "@/lib/docx";
import { scarica } from "@/lib/esportazioni";
import type { RigaComputo } from "@/calcoli/materiali/tipi";
import type { ParticolareLib } from "@/calcoli/particolari/allinea";

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

  function crea() {
    setErrore(""); setFile(null);
    try {
      let rischio = null;
      if (s.datiRischio) { const stato = leggiStato(s.datiRischio); rischio = { struttura: strutturaRischio(d, stato), zone: stato.zone }; }
      const doc = relazioneTecnica({
        edificio: d, codice: leggiAttivo()?.codice || undefined, revisioni: s.revisioni, lplDisegno: s.lpl,
        modello: s.modello, aste: s.aste, conduttori: s.conduttori, picchetti: s.picchetti, terra: s.terra,
        separazione: s.separazione, rischio, risultati: c.risultati, righe, mancanti, particolari, dati: r, data: new Date(),
      });
      const nome = `Relazione-LPS-${(d.nomeProgetto || d.comune || "progetto").replace(/[^\w.-]+/g, "_")}${s.revisioni.at(-1) ? `-Rev${s.revisioni.at(-1)!.rev}` : ""}.docx`;
      setFile({ blob: new Blob([creaDocx(doc)], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }), nome });
    } catch (e) { setErrore(e instanceof Error ? e.message : "Relazione non creata."); }
  }

  return <section className="mt-6 rounded-lg border p-4" aria-labelledby="h-relazione">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 id="h-relazione" className="font-display text-lg font-semibold">Relazione tecnica (Word)</h2>
        <p className="text-sm text-muted-foreground">Sul format OBO: premessa, norme 2024, valutazione del rischio con i valori calcolati, captazione, calate, separazione, terra, SPD, tipologici e elenco materiale. Le parti da scrivere a mano sono evidenziate in giallo.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setAperto(!aperto)} aria-expanded={aperto}>{aperto ? "Chiudi i dati" : "Dati della relazione"}</Button>
        <Button type="button" onClick={crea}><FileText />Crea relazione</Button>
        {file && <Button type="button" onClick={() => scarica(file.blob, file.nome)}><Download />Scarica Word</Button>}
      </div>
    </div>
    {aperto && <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {CAMPI.map((f) => <Campo key={f.k} etichetta={f.etichetta}><input className={inputCls} value={r[f.k]} maxLength={f.k === "destinazione" ? 500 : 200} placeholder={f.segnaposto} onChange={(e) => cambia(f.k, e.target.value)} /></Campo>)}
      <div className="sm:col-span-2"><Campo etichetta="Descrizione e sopralluogo (impianti e calate esistenti, componenti naturali, altezze da proteggere)"><textarea className={`${inputCls} min-h-28`} maxLength={20000} value={r.descrizione} onChange={(e) => cambia("descrizione", e.target.value)} /></Campo></div>
      <p className="text-xs text-muted-foreground sm:col-span-2">Comune, indirizzo, dimensioni e LPL vengono da Dati edificio; i valori del rischio dalla pagina Rischio; i tipologici dai particolari collegati al computo. L'attestato NG/NSG va allegato in originale.</p>
    </div>}
    {errore && <p role="alert" className="mt-3 text-sm text-destructive">{errore}</p>}
  </section>;
}
