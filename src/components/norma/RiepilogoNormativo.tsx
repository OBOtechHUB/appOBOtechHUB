/**
 * Riepilogo dei dati normativi usati dall'app (CEI EN IEC 62305:2026-10, parti 1–4), raggruppati per argomento.
 * I valori vengono dalle stesse costanti usate nei calcoli: pagina e calcoli restano sempre allineati.
 * Solo valori numerici e descrizioni scritte con parole nostre, con il riferimento alla tabella: nessun testo copiato.
 */
import { useState, type ReactNode } from "react";
import parametriLPL from "@/dati/captazione/parametriLPL.json";
import distanzaCalate from "@/dati/calate/distanzaCalate.json";
import {
  LPL, PARAMETRI_FULMINE, SEZIONI_CAPTATORI_CALATE, DIMENSIONI_DISPERSORI, SPESSORI_LASTRE, SEZIONI_EQUIPOTENZIALI,
  NOMI_MATERIALI, NOMI_CONFIGURAZIONI, raggioSfera, type Lpl,
} from "@/calcoli/norma/strumenti";
import { KI, KM, NOMI_MATERIALE as NOMI_ISOLANTI } from "@/calcoli/calate/separazione";
import { l1Norma } from "@/calcoli/terra/proponiTerra";
import { PLPS, PEB, PSPD, RT_R1, FT_CRITICI, FT_NON_CRITICI } from "@/calcoli/rischio/rischioR1";
import { CORRENTE_LPL, UW_CATEGORIA } from "@/calcoli/spd/sceltaSpd";
import { INTERVALLI_TIPICI, INTERVALLI_SEVERI } from "@/calcoli/verifiche/verifiche";

const P1 = "CEI EN IEC 62305-1:2026-10", P2 = "CEI EN IEC 62305-2:2026-10", P3 = "CEI EN IEC 62305-3:2026-10", P4 = "CEI EN IEC 62305-4:2026-10";
const num = (v: number, dec = 2) => v.toLocaleString("it-IT", { maximumFractionDigits: dec });
const esp = (v: number) => (v >= 0.01 ? num(v, 3) : v.toExponential(0).replace("e-", "·10⁻").replace(/(\d)$/, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)] ?? d));

interface Riga { voce: string; unita?: string; valori: (l: Lpl) => string | number }

function TabellaLpl({ righe, lpl }: { righe: Riga[]; lpl: Lpl | null }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm">
    <thead><tr className="border-b text-left"><th className="p-2">Grandezza</th><th className="p-2">Unità</th>
      {LPL.map((l) => <th key={l} className={`p-2 text-right ${l === lpl ? "bg-accent/15 text-accent" : ""}`}>{l === lpl ? `LPL ${l} ●` : `LPL ${l}`}</th>)}</tr></thead>
    <tbody>{righe.map((r) => <tr key={r.voce} className="border-b">
      <td className="p-2">{r.voce}</td><td className="p-2 text-muted-foreground">{r.unita ?? ""}</td>
      {LPL.map((l) => { const v = r.valori(l); return <td key={l} className={`p-2 text-right font-mono ${l === lpl ? "bg-accent/15 font-semibold" : ""}`}>{typeof v === "number" ? num(v) : v}</td>; })}
    </tr>)}</tbody></table></div>;
}

function Tabella({ intestazioni, righe }: { intestazioni: string[]; righe: (string | number)[][] }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr className="border-b text-left">{intestazioni.map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead>
    <tbody>{righe.map((r, i) => <tr key={i} className="border-b">{r.map((c, j) => <td key={j} className={`p-2 ${typeof c === "number" ? "font-mono" : ""}`}>{typeof c === "number" ? num(c) : c}</td>)}</tr>)}</tbody></table></div>;
}

function Blocco({ id, titolo, rif, aperto, children }: { id: string; titolo: string; rif: string; aperto?: boolean | undefined; children: ReactNode }) {
  return <details id={`norma-${id}`} open={aperto} className="group rounded-lg border bg-card">
    <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 p-3 font-semibold">
      <span><span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>{titolo}</span>
      <span className="text-xs font-normal text-muted-foreground">{rif}</span>
    </summary>
    <div className="space-y-3 border-t p-3">{children}</div>
  </details>;
}

const Nota = ({ children }: { children: ReactNode }) => <p className="text-xs text-muted-foreground">{children}</p>;

export const SEZIONI_NORMA = [
  ["fulmine", "Parametri del fulmine"], ["captazione", "Captazione"], ["calate", "Calate e distanza di separazione"],
  ["terra", "Dispersori"], ["materiali", "Materiali e sezioni minime"], ["rischio", "Valutazione del rischio"],
  ["spd", "SPD e tensioni di tenuta"], ["verifiche", "Verifiche periodiche"],
] as const;

const RESISTIVITA = [100, 500, 1000, 1500, 2000, 3000];

export function RiepilogoNormativo({ lplProgetto }: { lplProgetto: Lpl | null }) {
  const [lpl, setLpl] = useState<Lpl | null>(lplProgetto);
  const [tutti, setTutti] = useState<boolean | undefined>(undefined);
  const pf = PARAMETRI_FULMINE;
  return <div className="mt-3 space-y-3">
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Evidenzia:</span>
      {LPL.map((l) => <button key={l} type="button" aria-pressed={lpl === l} onClick={() => setLpl(lpl === l ? null : l)}
        className={`rounded-full border px-3 py-1 ${lpl === l ? "border-accent bg-accent text-accent-foreground" : "hover:bg-muted"}`}>LPL {l}{l === lplProgetto ? " (progetto)" : ""}</button>)}
      <span className="mx-1 text-muted-foreground">·</span>
      <button type="button" className="text-accent underline-offset-2 hover:underline" onClick={() => setTutti(tutti ? false : true)}>{tutti ? "Chiudi tutto" : "Apri tutto"}</button>
    </div>
    {!lplProgetto && <Nota>Il progetto non ha ancora un livello di protezione: sceglilo in Dati edificio o ricavalo dalla valutazione del rischio.</Nota>}
    <nav aria-label="Argomenti" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">{SEZIONI_NORMA.map(([id, t]) => <a key={id} href={`#norma-${id}`} className="text-accent hover:underline">{t}</a>)}</nav>

    <Blocco id="fulmine" titolo="Parametri del fulmine" rif={`${P1}, Tab. 3 e 4`} aperto={tutti ?? true}>
      <TabellaLpl lpl={lpl} righe={[
        { voce: "Primo colpo positivo – corrente di picco", unita: "kA", valori: (l) => pf[l].primoPositivo.I },
        { voce: "Primo colpo positivo – carica", unita: "C", valori: (l) => pf[l].primoPositivo.Q },
        { voce: "Primo colpo positivo – energia specifica (10/350 µs)", unita: "MJ/Ω", valori: (l) => pf[l].primoPositivo.WR },
        { voce: "Primo colpo negativo – picco (1/200 µs)", unita: "kA", valori: (l) => pf[l].primoNegativo.I },
        { voce: "Primo colpo negativo – pendenza media", unita: "kA/µs", valori: (l) => pf[l].primoNegativo.didt },
        { voce: "Colpo successivo – picco (0,25/100 µs)", unita: "kA", valori: (l) => pf[l].successivo.I },
        { voce: "Colpo successivo – pendenza media", unita: "kA/µs", valori: (l) => pf[l].successivo.didt },
        { voce: "Colpo lungo (0,5 s) – carica", unita: "C", valori: (l) => pf[l].QLungo },
        { voce: "Fulmine completo – carica", unita: "C", valori: (l) => pf[l].QFulmine },
        { voce: "Corrente minima di picco intercettata", unita: "kA", valori: (l) => pf[l].Imin },
        { voce: "Raggio della sfera rotolante", unita: "m", valori: (l) => pf[l].r },
      ]} />
      <Nota>I valori massimi servono al dimensionamento di conduttori, componenti e SPD; i minimi al posizionamento dei captatori. Raggio della sfera dalla corrente minima: r = 10 · I^0,65 (es. {num(pf.III.Imin)} kA → {num(raggioSfera(pf.III.Imin), 0)} m) ({P1}, A.4).</Nota>
    </Blocco>

    <Blocco id="captazione" titolo="Captazione" rif={`${P3}, Tab. 2 e 5.2`} aperto={tutti}>
      <TabellaLpl lpl={lpl} righe={[
        { voce: "Raggio della sfera rotolante", unita: "m", valori: (l) => parametriLPL[l].raggio },
        { voce: "Lato massimo della maglia", unita: "m", valori: (l) => parametriLPL[l].latoMaglia },
        { voce: "Lato della maglia con aumento ammesso (+25 %)", unita: "m", valori: (l) => parametriLPL[l].latoMaglia * 1.25 },
      ]} />
      <Nota>Tre metodi equivalenti, anche combinati: sfera rotolante (adatta a tutte le strutture), angolo di protezione (solo per altezze fino al raggio della sfera, angoli dal grafico della Fig. 1) e maglia (adatta alle superfici piane). Il lato della maglia può crescere fino al 25 % se il perimetro della maglia non aumenta. Il metodo usato va indicato nella documentazione di progetto.</Nota>
      <Nota>Pendenza del tetto: {parametriLPL.pendenzaMassimaMaglia.riferimentoNorma}.</Nota>
    </Blocco>

    <Blocco id="calate" titolo="Calate e distanza di separazione" rif={`${P3}, Tab. 5, 11, 12, 13 e 6.3`} aperto={tutti}>
      <TabellaLpl lpl={lpl} righe={[
        { voce: "Distanza preferenziale tra le calate", unita: "m", valori: (l) => distanzaCalate[l].distanzaTipica },
        { voce: "Coefficiente ki (classe dell'LPS)", valori: (l) => KI[l] },
      ]} />
      <div className="grid gap-3 md:grid-cols-2">
        <Tabella intestazioni={["Materiale isolante", "km"]} righe={(Object.keys(KM) as (keyof typeof KM)[]).map((k) => [NOMI_ISOLANTI[k], KM[k]])} />
        <Tabella intestazioni={["Numero di calate", "kc (semplificato)"]} righe={[["1 (solo LPS isolato)", 1], ["2", 0.66], ["3 o più", 0.44]]} />
      </div>
      <Nota>Distanza di separazione semplificata: s = ki · kc · l / km, con l lunghezza lungo captatore e calata fino al collegamento equipotenziale più vicino. I kc semplificati valgono per dispersori di tipo B e di tipo A con resistenze dei singoli elementi entro un fattore 2, altrimenti kc = 1. Con materiali isolanti in serie si usa il km più basso.</Nota>
      <Nota>LPS non isolato: almeno 2 calate distribuite sul perimetro, possibilmente equidistanti e una per ogni spigolo; mai dentro grondaie o pluviali. Calate collegate da conduttori ad anello: riducono s e migliorano la ripartizione della corrente.</Nota>
    </Blocco>

    <Blocco id="terra" titolo="Dispersori" rif={`${P3}, 5.4 e Fig. 5`} aperto={tutti}>
      <Tabella intestazioni={["Resistività del terreno (Ω·m)", ...LPL.map((l) => `l1 LPL ${l} (m)`)]}
        righe={RESISTIVITA.map((r) => [num(r, 0), ...LPL.map((l) => num(l1Norma(l, r), 1))])} />
      <Nota>Lunghezza minima l1 di ogni elemento del dispersore, letta dal grafico della norma (per LPL III e IV non dipende dalla resistività). Tipo A: almeno 2 elementi in tutto (consigliato uno per calata), lunghi almeno l1 se orizzontali e 0,5 · l1 se verticali o inclinati, interrati ad almeno 0,5 m; la parte alta dei picchetti in terreno che gela o si secca non si conta. Il requisito di lunghezza si può ignorare se la resistenza di terra del tipo A è sotto 10 Ω. Tipo B (anello a contatto col suolo per almeno l'80 % o dispersore di fondazione): raggio del cerchio di area equivalente almeno pari a l1, altrimenti si aggiungono almeno 2 dispersori. Oltre 3000 Ω·m è consigliato il tipo B.</Nota>
    </Blocco>

    <Blocco id="materiali" titolo="Materiali e sezioni minime" rif={`${P3}, Tab. 3, 7, 8, 9 e 10`} aperto={tutti}>
      <h3 className="text-sm font-semibold">Captatori, aste e calate (Tab. 7)</h3>
      <Tabella intestazioni={["Materiale", "Forma", "Sezione minima (mm²)"]} righe={SEZIONI_CAPTATORI_CALATE.map((s) => [NOMI_MATERIALI[s.materiale], NOMI_CONFIGURAZIONI[s.configurazione], s.sezione])} />
      <h3 className="text-sm font-semibold">Dispersori (Tab. 8)</h3>
      <Tabella intestazioni={["Materiale", "Forma", "Diametro (mm)", "Sezione (mm²)", "Piastra (mm)"]} righe={DIMENSIONI_DISPERSORI.map((d) => [NOMI_MATERIALI[d.materiale], NOMI_CONFIGURAZIONI[d.configurazione], d.diametro ?? "–", d.sezione ?? "–", d.piastra ?? "–"])} />
      <div className="grid gap-3 md:grid-cols-2">
        <div><h3 className="mb-1 text-sm font-semibold">Lastre come captatori naturali (Tab. 3)</h3>
          <Tabella intestazioni={["Materiale", "t senza perforazione (mm)", "t' (mm)"]} righe={SPESSORI_LASTRE.map((s) => [NOMI_MATERIALI[s.materiale], s.t ?? "–", s.t1])} /></div>
        <div><h3 className="mb-1 text-sm font-semibold">Conduttori equipotenziali (Tab. 9 e 10)</h3>
          <Tabella intestazioni={["Materiale", "Tra le barre / verso terra (mm²)", "Verso corpi interni (mm²)"]} righe={(Object.keys(SEZIONI_EQUIPOTENZIALI) as (keyof typeof SEZIONI_EQUIPOTENZIALI)[]).map((k) => [k[0]?.toUpperCase() + k.slice(1), SEZIONI_EQUIPOTENZIALI[k].traBarre, SEZIONI_EQUIPOTENZIALI[k].corpiInterni])} /></div>
      </div>
      <Nota>t: spessore che evita la perforazione o il surriscaldamento nel punto d'impatto (richiesto se sotto la lastra c'è materiale infiammabile); t': spessore minimo quando la perforazione è accettabile.</Nota>
    </Blocco>

    <Blocco id="rischio" titolo="Valutazione del rischio" rif={`${P2}, 7.3, 9.3, Tab. B.3, B.7, B.13`} aperto={tutti}>
      <TabellaLpl lpl={lpl} righe={[
        { voce: "PLPS – struttura protetta da LPS di questa classe", valori: (l) => PLPS[l] },
        { voce: "PEB – SPD per il collegamento equipotenziale", valori: (l) => PEB[l] },
        { voce: "PSPD – sistema coordinato di SPD", valori: (l) => PSPD[l] },
      ]} />
      <Tabella intestazioni={["Valore tollerabile", "Valore"]} righe={[
        ["Rischio tollerabile RT per la perdita di vite umane (R1)", esp(RT_R1)],
        ["Frequenza tollerabile FT – impianti critici", `${num(FT_CRITICI)} / anno`],
        ["Frequenza tollerabile FT – impianti non critici", `${num(FT_NON_CRITICI)} / anno`],
      ]} />
      <Nota>Il calcolo del rischio è provato in automatico sui tre esempi dell'Allegato F (fabbricato residenziale, edificio per uffici, ospedale): a ogni aggiornamento dell'app deve dare gli stessi risultati della norma, con e senza protezione.</Nota>
      <Nota>Senza LPS PLPS = 1. Valori più bassi di PLPS (0,01 e 0,001) solo per LPS di classe I con struttura metallica o in cemento armato continuo usata come calata naturale (e copertura metallica completamente protetta per 0,001).</Nota>
    </Blocco>

    <Blocco id="spd" titolo="SPD e tensioni di tenuta" rif={`${P1}, Allegato E; ${P4}, Allegato C`} aperto={tutti}>
      <TabellaLpl lpl={lpl} righe={[
        { voce: "Corrente di picco del fulmine", unita: "kA", valori: (l) => CORRENTE_LPL[l] },
        { voce: "Quota verso i servizi entranti (50 %)", unita: "kA", valori: (l) => CORRENTE_LPL[l] * 0.5 },
        { voce: "Iimp per polo – 1 linea TN-S trifase (5 conduttori)", unita: "kA", valori: (l) => (CORRENTE_LPL[l] * 0.5) / 5 },
      ]} />
      <Tabella intestazioni={["Categoria di sovratensione (rete 230/400 V)", "Uw (kV)", "Up massimo consigliato (kV)"]}
        righe={(Object.keys(UW_CATEGORIA) as (keyof typeof UW_CATEGORIA)[]).map((k) => [`Categoria ${k}`, UW_CATEGORIA[k], num(UW_CATEGORIA[k] * 0.8)])} />
      <Nota>Stima semplificata: metà della corrente del fulmine si divide in parti uguali tra i servizi entranti e poi tra i loro conduttori; la pagina SPD fa il calcolo con i dati reali. Up dell'SPD, comprese le cadute nei collegamenti, sotto circa l'80 % della tensione di tenuta Uw degli apparecchi protetti. Uc almeno 1,1 · U0.</Nota>
    </Blocco>

    <Blocco id="verifiche" titolo="Verifiche periodiche" rif={`${P3}, art. 7 e D.7.2.2`} aperto={tutti}>
      <Tabella intestazioni={["Situazione", "Esame a vista", "Verifica completa"]} righe={[
        ["Strutture ordinarie (tutte le classi)", `ogni ${num(INTERVALLI_TIPICI.I.visiva)} anno`, `ogni ${num(INTERVALLI_TIPICI.I.completa)} anni`],
        ["Sistemi critici (esplosione, impianti sensibili, uffici, commerciali, affollamento)", `ogni ${num(INTERVALLI_TIPICI.I.visiva)} anno`, `ogni ${num(INTERVALLI_TIPICI.I.critica)} anno`],
        ["Condizioni ambientali severe", "ogni 6 mesi", `ogni ${num(INTERVALLI_SEVERI.completa)} anno`],
      ]} />
      <Nota>Nell'edizione 2026-10 gli intervalli non dipendono più dalla classe dell'LPS. Se l'esame a vista annuale non si fa, verifica completa ogni 2 anni. Verifica straordinaria dopo modifiche della struttura, riparazioni o un fulmine sull'LPS. Mai verifiche durante i temporali.</Nota>
    </Blocco>
  </div>;
}
