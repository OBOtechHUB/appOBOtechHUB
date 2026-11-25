/**
 * Relazione tecnica dell'impianto di protezione dalle scariche atmosferiche, sul modello della relazione OBO
 * (format di Marco Lo Vetere, novembre 2025) aggiornato all'edizione CEI EN IEC 62305:2026-10 (IEC 62305:2024).
 *
 * Testo descrittivo: tutto quello del format OBO (stessi capitoli e paragrafi, in due parti: relazione
 * dell'impianto e "Valutazione del rischio e scelta delle misure di protezione"), corretto solo dove
 * l'edizione 2026-10 cambia le cose (cause D1T/D1D, perdite L1/L2/L3, un solo rischio R = RL1 + RL2 e frequenza del danno F al posto di R2, R3, R4;
 * EN 50164 sostituita dalla serie EN IEC 62561). Le definizioni sono scritte con parole nostre: nessun testo o
 * figura della norma è copiato, solo valori e riferimenti.
 * Valori del progetto: dai dati e dai calcoli dell'app. Le parti che l'app non conosce (sopralluogo,
 * fotografie, scelte del progettista) restano evidenziate in giallo "[DA COMPLETARE …]".
 * Logica pura: nessun accesso a stato, DOM o rete.
 */
import { OBO, type Blocco, type Documento, type Run, type Testo } from "@/lib/docx";
import type { RigaComputo, RisultatiModuli } from "@/calcoli/materiali/tipi";
import { categorie } from "@/calcoli/materiali/tipi";
import type { Asta, Conduttore, ModelloEdificio } from "@/calcoli/edificio/tipi";
import type { ParticolareLib } from "@/calcoli/particolari/allinea";
import { CATEGORIE, CONNESSIONI, MISURE_CONTATTO, RISCHIO_INCENDIO, PROTEZIONE_INCENDIO, PAVIMENTO, RT, calcolaZone, protezioneMinimaZone, type ClasseLps, type EsitoStruttura, type Struttura, type Zona, type Linea } from "@/calcoli/rischio/rischioR1";
import { KI, KM, NOMI_MATERIALE, kcSemplificato, perimetro, verificaPunti, type PuntoCritico } from "@/calcoli/calate/separazione";
import parametriLPL from "@/dati/captazione/parametriLPL.json";
import distanzaCalate from "@/dati/calate/distanzaCalate.json";
import fattori from "@/dati/rischio/fattorePosizione.json";
import { DIMENSIONI_DISPERSORI, NOMI_CONFIGURAZIONI, NOMI_MATERIALI, SEZIONI_CAPTATORI_CALATE, SEZIONI_EQUIPOTENZIALI, SPESSORI_LASTRE } from "@/calcoli/norma/strumenti";
import { PLPS, PEB, PSPD } from "@/calcoli/rischio/rischioR1";
import { CORRENTE_LPL } from "@/calcoli/spd/sceltaSpd";
import { l1Norma } from "@/calcoli/terra/proponiTerra";
import blocchiTreppiede from "@/dati/captazione/blocchiTreppiede.json";
import { NOME_TIPO, blocchiPerVento, fraseCalate, fraseIntervento, fraseSoluzione, frasiStatoDiFatto, tipoAsta, verificaCorpi, type InfoArticolo, type TipoAsta } from "./testiProgetto";
import { schemaBlocchi } from "./grafici";
import { dataIt, destinazioneDi } from "./destinazioni";
import { spessorePutrella } from "./putrelle";
import { NOME_METODO, verificaVentoProgetto, type DatiVentoProgetto } from "@/calcoli/vento/progetto";
import { descriviBasi, CATEGORIE as CATEGORIE_VENTO, ZONE as ZONE_VENTO, ce as ceVento, pressioneBase, velocitaBase } from "@/calcoli/vento/vento";
import { disegnoDaComponenti, disegnoSchema, svgTipologico, type IndiceDisegniObo } from "@/calcoli/particolari/tipologico";
import { ruoloDi } from "@/calcoli/particolari/allinea";
import { traduciDocumento } from "./traduzione";
import { barreLog, curvaCorrente, flussoValutazione, graficoSeparazione, graficoSfera, piantaCopertura, schemaSorgenti } from "./grafici";
import { formattaNome } from "@/lib/nomi";

export type Lpl = "I" | "II" | "III" | "IV";

/** Dati della relazione che l'app non calcola (salvati nel progetto). */
export type SiNo = "no" | "si" | "da-verificare";
export type Naturale = "no" | "si-collegato" | "si-da-collegare" | "si-da-verificare";
export interface DatiRelazione {
  committente: string; indirizzoCommittente: string; cittaCommittente: string;
  provincia: string; titoloOpera: string; destinazione: string; luogo: string;
  /** testo libero: sopralluogo, impianti esistenti, scelte del progettista */
  descrizione: string;
  tipoIntervento: "nuovo" | "adeguamento" | "integrazione"; ngFornitore: string; ngData: string; nsgAttestato: number | null;
  parapetto: Naturale; strutturaMetallica: Naturale; armature: SiNo; coperturaMetallica: boolean;
  calateEsistenti: "nessuna" | "naturali" | "in-getto" | "esterne"; calateNumero: number | null; calateInterasse: number | null;
  terraEsistente: "nessuno" | "anello" | "fondazione" | "picchetti" | "misto"; terraCollegataAltri: boolean; spdEsistenti: SiNo;
  impiantiCopertura: string; altezzaImpianti: number | null;
  fissaggioAste: "putrella" | "parapetto" | "treppiede" | "basamento" | "parete" | "misto"; ventoKmh: number | null; margineSicurezza: number;
  corpi: Record<string, { altezzaDaProteggere: number | null; nota: string; metallica: boolean }>;
  /** captazione a putrella: profilo (es. "IPE 200") e/o spessore dell'ala in mm */
  putrellaProfilo: string; putrellaSpessore: number | null;
  valutazioneEconomica: boolean; tecnico: string; albo: string;
  /** impresa installatrice (dichiarazione di conformità D.M. 37/2008) */
  impresaNome: string; impresaSede: string; impresaPiva: string; impresaCciaa: string; impresaResponsabile: string;
  /** verifiche: luogo di lavoro (D.P.R. 462/2001), condizioni ambientali severe, data di messa in esercizio AAAA-MM-GG */
  luogoDiLavoro: boolean; ambienteSevero: boolean; dataMessaEsercizio: string;
  /** lingua dei documenti */
  lingua: "it" | "en";
}
export const datiRelazioneVuoti: DatiRelazione = {
  committente: "", indirizzoCommittente: "", cittaCommittente: "", provincia: "", titoloOpera: "", destinazione: "", luogo: "Rivoli", descrizione: "",
  tipoIntervento: "nuovo", ngFornitore: "", ngData: "", nsgAttestato: null,
  parapetto: "no", strutturaMetallica: "no", armature: "no", coperturaMetallica: false,
  calateEsistenti: "nessuna", calateNumero: null, calateInterasse: null,
  terraEsistente: "nessuno", terraCollegataAltri: false, spdEsistenti: "no",
  impiantiCopertura: "", altezzaImpianti: null,
  fissaggioAste: "misto", ventoKmh: null, margineSicurezza: 1,
  corpi: {}, putrellaProfilo: "", putrellaSpessore: null, valutazioneEconomica: false, tecnico: "", albo: "",
  impresaNome: "", impresaSede: "", impresaPiva: "", impresaCciaa: "", impresaResponsabile: "",
  luogoDiLavoro: false, ambienteSevero: false, dataMessaEsercizio: "", lingua: "it",
};

export interface ImmagineIn { dati: Uint8Array; jpeg: boolean; larghezzaPx: number; altezzaPx: number }
/** Blocco immagine da un'immagine pronta, larga `cm` (altezza massima `maxH` cm). */
export function bloccoImmagine(im: ImmagineIn, cm: number, allinea: "sinistra" | "centro" | "destra" = "centro", maxH = 20): Blocco {
  let w = cm, h = (cm * im.altezzaPx) / Math.max(1, im.larghezzaPx);
  if (h > maxH) { w = (w * maxH) / h; h = maxH; }
  return { tipo: "immagine", svg: "", png: im.dati, jpeg: im.jpeg, larghezza: Math.round(w * 100) / 100, altezza: Math.round(h * 100) / 100, allinea };
}
export interface IngressoRelazione {
  edificio: { nomeProgetto: string; comune: string; indirizzo?: string | undefined; lat?: number | null | undefined; lon?: number | null | undefined; L: number; W: number; H: number; copertura: string; materiale: string; impiantiTetto: boolean; posizioneId: string; densita: number; lplProgetto: Lpl | null };
  codice?: string | undefined;
  revisioni: { rev: string; data: string; autore: string; descrizione: string }[];
  lplDisegno: Lpl;
  modello: ModelloEdificio; aste: Asta[]; conduttori: Conduttore[];
  picchetti: { lunghezza: number }[];
  terra: { tipo: "A" | "B" | "fondazione"; distanzaAnello: number; profondita: number; lunghezzaPicchetto: number; l1: number | null } | null;
  separazione: { ki: number | null; kmSolido: number | null; punti: PuntoCritico[] };
  /** dati del rischio già letti (statoRischio.leggiStato + strutturaRischio); null = valutazione non compilata */
  rischio: { struttura: Struttura; zone: Zona[] } | null;
  risultati: RisultatiModuli; righe: RigaComputo[]; mancanti: string[];
  particolari: readonly ParticolareLib[];
  dati: DatiRelazione;
  /** nome e dati tecnici degli articoli (catalogo OBO), per riconoscere il tipo delle aste */
  articoli?: Record<string, InfoArticolo> | undefined;
  /** immagini già pronte (PNG o JPEG): logo OBO, stemma del Comune, logo del committente, foto e planimetrie */
  immagini?: { logo?: ImmagineIn | undefined; stemma?: ImmagineIn | undefined; logoCommittente?: ImmagineIn | undefined; foto?: { img: ImmagineIn; didascalia: string }[] | undefined } | undefined;
  /** Comune riconosciuto (Wikidata): nome ufficiale e provincia, usati quando i dati della relazione non li indicano */
  comuneUfficiale?: { nome: string; provincia: string } | undefined;
  /** autore e licenza dello stemma scaricato, riportati negli allegati quando la licenza lo chiede */
  creditoStemma?: string | undefined;
  /** disegni 2D OBO copiati nell'app, per i tipologici disegnati con i blocchi OBO */
  disegniObo?: IndiceDisegniObo | null | undefined;
  /** parametri del vento (pagina Vento e zavorre): se ci sono, la relazione riporta la verifica al vento di tutte le aste */
  vento?: DatiVentoProgetto | undefined;
  data: Date;
}

// ---------- formattazione ----------
const it = (v: number, dec = 2) => v.toLocaleString("it-IT", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
const SUP: Record<string, string> = { "-": "-", "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7", "8": "8", "9": "9" };
/** Numero in notazione scientifica: 1,23 × 10⁻⁵ (esponente in apice). */
export function sci(v: number, dec = 2): Run[] {
  if (!Number.isFinite(v)) return [{ t: "—" }];
  if (v === 0) return [{ t: "0" }];
  const e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
  if (e >= -2 && e <= 3) return [{ t: it(v, Math.max(dec, -e + dec - 1)) }];
  return [{ t: `${it(m, dec)} × 10` }, { t: String(e).split("").map((c) => SUP[c] ?? c).join(""), sup: true }];
}
const dc = (t: string): Run => ({ t: `[DA COMPLETARE: ${t}]`, daCompletare: true });
const p = (testo: Testo, extra: Partial<Extract<Blocco, { tipo: "par" }>> = {}): Blocco => ({ tipo: "par", testo, ...extra });
const h1 = (testo: string): Blocco => ({ tipo: "titolo", livello: 1, testo });
const h2 = (testo: string): Blocco => ({ tipo: "titolo", livello: 2, testo });
const h3 = (testo: string): Blocco => ({ tipo: "titolo", livello: 3, testo });
const el = (...voci: Testo[]): Blocco => ({ tipo: "elenco", voci });
const tab = (intestazione: Testo[], righe: Testo[][], larghezze?: number[], evidenziaColonna?: number): Blocco => ({ tipo: "tabella", intestazione, righe, ...(larghezze ? { larghezze } : {}), ...(evidenziaColonna != null ? { evidenziaColonna } : {}), ...(intestazione.length > 7 ? { dimensione: 7.5 } : {}) });
const pedice = (base: string, ped: string): Run[] => [{ t: base }, { t: ped, sub: true }];

const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const dataLunga = (d: Date) => `${d.getDate()} ${MESI[d.getMonth()]} ${d.getFullYear()}`;
const LIVELLI: Lpl[] = ["I", "II", "III", "IV"];
const nomeProtezione = (c: ClasseLps) => (c === "nessuno" ? "nessuna" : `LPS e SPD di livello ${c}`);

function lunghezza(c: Conduttore): number {
  let t = 0; for (let i = 1; i < c.punti.length; i++) { const a = c.punti[i - 1]!, b = c.punti[i]!; t += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); } return t;
}
function areaPoligono(pts: [number, number][]): number {
  return Math.abs(pts.reduce((a, q, i) => { const r = pts[(i + 1) % pts.length]!; return a + q[0] * r[1] - r[0] * q[1]; }, 0) / 2);
}

/** Particolare a cui si riferisce una riga del computo (dalla provenienza). */
export function particolareDiRiga(r: RigaComputo, lib: readonly ParticolareLib[]): ParticolareLib | null {
  const intero = r.provenienza.match(/OBO-TBS-[A-Za-z0-9.-]+/)?.[0];
  if (intero) return lib.find((x) => x.id === intero) ?? { id: intero, nome: intero, componenti: [] };
  const breve = r.provenienza.match(/particolare\s+([A-Za-z0-9.-]+)/)?.[1];
  if (breve) return lib.find((x) => x.id === breve || x.id.endsWith(`-${breve}`)) ?? null;
  return null;
}

const UNITA_TIPICA: Record<string, string> = { per_m: "/m", per_punto: "/punto", per_calata: "/calata", fisso: "", per_asta: "/asta", per_supporto: "/supporto", per_incrocio: "/incrocio", per_compensatore: "/compens.", per_punta: "/punta", per_progetto: "/progetto", per_picchetto: "/picchetto", per_elemento: "/elemento", per_giunto: "/giunto" };

/** Profondità di penetrazione della sfera rotolante tra due captatori distanti d (m): p = R − √(R² − (d/2)²). */
export function penetrazione(R: number, d: number): number {
  const h = d / 2; return h >= R ? R : R - Math.sqrt(R * R - h * h);
}

/** Componi la relazione tecnica. */
export function relazioneTecnica(x: IngressoRelazione): Documento {
  const d = x.edificio, r = x.dati, B: Blocco[] = [];
  const lpl: Lpl = d.lplProgetto ?? x.lplDisegno;
  const rev = x.revisioni.at(-1)?.rev;
  const titolo = r.titoloOpera || d.nomeProgetto || "";
  const corpi = x.modello.corpi;
  const par = parametriLPL as unknown as Record<string, { raggio: number; latoMaglia: number }>;
  const R = par[lpl]!.raggio;
  // tipo di ogni asta (catalogo + descrizioni del computo) e verifica per corpo
  const articoli: Record<string, InfoArticolo> = {};
  for (const rr of x.righe) if (rr.codice) articoli[rr.codice] = { nome: `${articoli[rr.codice]?.nome ?? ""} ${rr.descrizione}` };
  for (const [c, a] of Object.entries(x.articoli ?? {})) articoli[c] = { nome: `${a.nome} ${articoli[c]?.nome ?? ""}`, dati: a.dati };
  const tipi = new Map<string, TipoAsta>(x.aste.map((a) => [a.id, tipoAsta(a.codiceOBO, articoli, r.fissaggioAste)]));
  const verifiche = verificaCorpi(x.modello.corpi, x.aste, x.conduttori, R, r, tipi);
  const NOME_BREVE: Record<TipoAsta, string> = { isolata: "isolata su treppiede", treppiede: "su treppiede", basamento: "su basamento", fissa: "fissata alla struttura" };
  let nFig = 0, nTab = 0;
  /** figura numerata: SVG (larghezza in px → 16 cm) con didascalia */
  const fig = (svgTesto: string | null, didascalia: string, cm = 16) => {
    if (!svgTesto) return;
    const w = Number(svgTesto.match(/width="(\d+)"/)?.[1] ?? 900), h = Number(svgTesto.match(/height="(\d+)"/)?.[1] ?? 400);
    B.push({ tipo: "immagine", svg: svgTesto, larghezza: cm, altezza: Math.round((cm * h / w) * 100) / 100 }, p([{ t: `Figura ${++nFig} – `, b: true }, { t: didascalia }], { allinea: "centro", dimensione: 9 }));
  };
  /** tabella numerata con titolo sopra */
  const tabN = (titoloT: string, ...a: Parameters<typeof tab>) => B.push(p([{ t: `Tabella ${++nTab} – `, b: true }, { t: titoloT }], { dimensione: 9, spazioDopo: 2, conSuccessivo: true }), tab(...a));
  const evid = (b: Blocco, righe: number[]): Blocco => (b.tipo === "tabella" ? { ...b, evidenziaRighe: righe } : b);
  const dest = destinazioneDi(r.destinazione);
  const destinazione: Run[] = dest ? [{ t: dest.nome.toLowerCase() }] : r.destinazione ? [{ t: r.destinazione }] : [dc("destinazione d'uso (abitativa, ricettiva o uso promiscuo)")];
  const committente: Run[] = r.committente ? [{ t: r.committente, b: true }] : [dc("committente")];
  const indirizzoComm: Run[] = r.indirizzoCommittente || r.cittaCommittente ? [{ t: [r.indirizzoCommittente, r.cittaCommittente].filter(Boolean).join("\n") }] : [dc("indirizzo del committente")];

  const im = x.immagini ?? {};
  const comuneNome = x.comuneUfficiale?.nome || d.comune;
  const provincia = r.provincia || x.comuneUfficiale?.provincia || "";
  // copertina secondo lo standard OBO: logo, fascia in secondario scuro con titolo, barra arancio, dati del progetto
  const copertina = (sottotitolo: string, seconda?: string) => {
    B.push(
      ...(im.logo ? [bloccoImmagine(im.logo, 4.2, "sinistra", 3)] : [p([{ t: "OBO BETTERMANN", b: true, colore: OBO.arancio }], { dimensione: 18 })]),
      p([{ t: "OBO Bettermann S.r.l.", b: true }], { allinea: "destra", dimensione: 10, spazioDopo: 0 }),
      p([{ t: "Via C. Ferrero 16 · 10098 Rivoli (TO)\nTel. +39 011 9548 811 · tecnico@obo.it · www.obo.it", carattere: "leggero" }], { allinea: "destra", dimensione: 8.5, spazioDopo: im.stemma ? 10 : 40 }),
      ...(im.stemma ? [bloccoImmagine(im.stemma, 2.4, "centro", 3)] : []),
      { tipo: "fascia", colore: OBO.sec1, altezza: 7.2, righe: [
        { testo: comuneNome ? [{ t: `COMUNE DI ${comuneNome.toUpperCase()}`, carattere: "condensato" }] : [dc("comune")], dimensione: 12, grassetto: true, colore: OBO.sec4 },
        { testo: provincia ? [{ t: `PROVINCIA DI ${provincia.toUpperCase()}`, carattere: "condensatoLeggero" }] : [dc("provincia")], dimensione: 11, colore: OBO.sec4 },
        { testo: " ", dimensione: 8 },
        { testo: titolo ? [{ t: titolo.toUpperCase(), carattere: "condensato" }] : [dc("titolo dell'opera")], dimensione: 15, grassetto: true, colore: OBO.arancio },
        { testo: [{ t: sottotitolo, carattere: "condensato" }], dimensione: 24, grassetto: true },
        ...(seconda ? [{ testo: [{ t: seconda, carattere: "condensatoLeggero" as const }], dimensione: 15, colore: OBO.sec4 }] : []),
      ] },
      { tipo: "fascia", colore: OBO.arancio, righe: [], altezza: 0.18 },
      p("", { spazioDopo: 14 }),
    );
    const dati: Testo[][] = [
      [[{ t: "Committente", b: true }], [...committente, ...(r.indirizzoCommittente || r.cittaCommittente ? [{ t: "\n" + [r.indirizzoCommittente, r.cittaCommittente].filter(Boolean).join(" · ") }] : [{ t: "\n" }, dc("indirizzo del committente")])]],
      [[{ t: "Norma di riferimento", b: true }], "CEI EN IEC 62305-1/2/3/4:2026-10"],
      [[{ t: "Livello di protezione", b: true }], `LPL ${lpl} – LPS di classe ${lpl}`],
      [[{ t: "Progetto", b: true }], [x.codice ? `n. ${x.codice}` : "—", rev ? `Rev. ${rev}` : "Bozza"].join(" · ")],
      [[{ t: "Luogo e data", b: true }], `${r.luogo || "Rivoli"}, ${dataLunga(x.data)}`],
    ];
    if (im.logoCommittente) B.push(bloccoImmagine(im.logoCommittente, 3.6, "destra", 1.8));
    B.push({ tipo: "tabella", intestazione: [], righe: dati, larghezze: [3.2, 8.8], dimensione: 10 },
      p("", { spazioPrima: 30 }),
      p([{ t: "Building Connections", b: true, colore: OBO.arancio }], { allinea: "destra", dimensione: 12 }),
      { tipo: "salto" });
  };

  // =====================================================================================
  // PARTE 1 – RELAZIONE IMPIANTO DI PROTEZIONE DALLE SCARICHE ATMOSFERICHE
  // =====================================================================================
  copertina("Relazione impianto di protezione\ndalle scariche atmosferiche");
  if (x.revisioni.length) B.push(h3("Revisioni del documento"), tab(["Rev.", "Data", "Descrizione", "Autore"], x.revisioni.map((v) => [v.rev, new Date(v.data).toLocaleDateString("it-IT"), v.descrizione, formattaNome(v.autore)]), [1, 2, 6, 3]));
  B.push({ tipo: "sommario", titolo: "Sommario" });

  // ---------- 1 Premessa
  B.push(h1("1. Premessa"),
    p([{ t: "Scopo del presente documento è la descrizione (ai sensi del D.M. 22 gennaio 2008, n. 37) della realizzazione dell'impianto di protezione dalle scariche atmosferiche per la struttura " }, ...(titolo ? [{ t: `denominata «${titolo}»` }] : [dc("nome della struttura")]), { t: ` ubicata a ${comuneNome || "…"}${provincia ? ` (${provincia})` : ""}${d.indirizzo ? `, ${d.indirizzo},` : ""} e destinata a: ` }, ...destinazione, { t: "." }]),
    p("Gli impianti elettrici sono stati progettati nell'osservanza delle seguenti leggi, decreti, circolari, Norme CEI e Norme UNI nel loro insieme e con particolare riferimento alle Norme CEI indicate."),
    p("Di conseguenza tutti gli impianti elettrici dovranno essere realizzati in conformità alle Norme CEI, guide incluse, alle norme UNI e nel rispetto di tutta la legislazione vigente alla data di esecuzione delle opere."),
    p("Dovranno essere utilizzati componenti che rispondono alle relative Norme CEI e Norme UNI ed alle tabelle di unificazione CEI-UNEL, ove queste esistano; che hanno marcatura CE e che hanno preferibilmente marchio IMQ e quelli previsti dal D.Lgs. 81/08 e successive modificazioni. I componenti dell'LPS devono essere conformi alla serie CEI EN IEC 62561."),
    p("Le condizioni tecniche inserite nel presente documento, integrate con i disegni allegati, illustrano i criteri di esecuzione e le caratteristiche dei materiali da installare."),
  );

  // ---------- 2 Elenco elaborati
  B.push(h1("2. Elenco elaborati"), el("Relazione tecnica", "Particolari costruttivi", "Disegni tecnici di posizionamento", "Elenco materiale"));

  // ---------- 3 Norme
  B.push(h1("3. Norme e leggi"),
    h2("3.1 Norme e leggi generali"),
    el("D.Lgs. 81/2008 – Testo unico sulla salute e sicurezza sul lavoro;", "D.M. 22 gennaio 2008, n. 37 – Regolamento sugli impianti negli edifici;", "Norme CEI 64-8;", "Norme CEI 64-52;", "Norme CEI 17-13/1;", "Norme CEI 23-51."),
    h2("3.2 Norme di riferimento per verifiche e prove"),
    el("CEI 11-1 (MT)", "CEI 11-48 (sicurezza)", "CEI 64-8/2 (prove)", "CEI 64-8/4", "CEI 64-8/5", "CEI 64-8/6", "CEI 64-14 (guida alle verifiche)"),
    h2("3.3 Norme di riferimento per LPS"),
    el("CEI EN IEC 62305-1:2026-10 – Protezione contro i fulmini. Parte 1: Principi generali",
      "CEI EN IEC 62305-2:2026-10 – Protezione contro i fulmini. Parte 2: Gestione del rischio",
      "CEI EN IEC 62305-3:2026-10 – Protezione contro i fulmini. Parte 3: Danno materiale alle strutture e pericolo per le persone",
      "CEI EN IEC 62305-4:2026-10 – Protezione contro i fulmini. Parte 4: Impianti elettrici ed elettronici nelle strutture",
      "CEI EN IEC 62561 serie da 1 a 8 – Componenti dei sistemi di protezione contro i fulmini (LPSC, Lightning Protection System Components). Sono gli adeguamenti della norma europea EN alla norma internazionale IEC e sostituiscono la serie CEI EN 50164 (CEI 81-5)",
      "CEI EN IEC 62858 – Densità di fulminazione. Reti di localizzazione fulmini (LLS) – Principi generali",
      "CEI 81-29 – Linee guida per l'applicazione delle norme CEI EN 62305",
      "CEI 64-8 – Impianti elettrici utilizzatori a tensione nominale non superiore a 1000 V in corrente alternata e a 1500 V in corrente continua",
      "CEI 11-1 – Impianti elettrici con tensione superiore a 1 kV in corrente alternata",
      "CEI EN 50522 – Messa a terra degli impianti elettrici a tensione superiore a 1 kV in c.a.",
      "DPR 462/01 – Procedimento per la denuncia di installazioni e dispositivi di protezione contro le scariche atmosferiche, di dispositivi di messa a terra di impianti elettrici e di impianti elettrici pericolosi",
      "CEI 64-12 – Guida per l'esecuzione dell'impianto di terra negli edifici per uso residenziale e terziario",
      "CEI 11-37 – Guida per l'esecuzione degli impianti di terra nei sistemi utilizzatori di energia alimentati a tensione maggiore di 1 kV"),
    p("Le norme CEI EN IEC 62305-1…4:2026-10, che recepiscono le norme internazionali IEC 62305:2024, sostituiscono l'edizione 2013 (CEI EN 62305, classificazione CEI 81-10). I valori e i metodi riportati nel documento sono quelli dell'edizione 2026-10.", { dimensione: 9 }),
  );

  // ---------- 4 Descrizione
  B.push(h1("4. Descrizione"),
    p(fraseIntervento(r, lpl)));

  // ---------- 5 Definizioni
  const def = (t: string, s: string): Testo => [{ t: `${t}: `, b: true }, { t: s }];
  B.push(h1("5. Definizioni"), el(
    def("Fulmine su una struttura", "fulmine che colpisce direttamente la struttura da proteggere."),
    def("Fulmine in prossimità di una struttura", "fulmine che cade abbastanza vicino alla struttura da proteggere da poter generare sovratensioni pericolose al suo interno."),
    def("Fulmine su una linea", "fulmine che colpisce una linea (energia, telecomunicazioni, dati) collegata alla struttura da proteggere."),
    def("Fulmine in prossimità di una linea", "fulmine che cade abbastanza vicino a una linea collegata alla struttura da poter indurre su di essa sovratensioni pericolose."),
    def("Danni ad esseri viventi", "lesioni, fino alla perdita della vita, di persone o animali dovute alle tensioni di contatto e di passo prodotte dal fulmine."),
    def("LEMP", "impulso elettromagnetico del fulmine: l'insieme degli effetti elettromagnetici della corrente di fulmine, che si accoppiano agli impianti per via resistiva, induttiva e capacitiva generando impulsi e campi."),
    def("LPL", "livello di protezione: numero da I a IV a cui corrisponde un gruppo di valori dei parametri della corrente di fulmine, scelto in modo che la probabilità che i valori di progetto, massimo e minimo, siano superati in natura resti accettabile."),
    def("Misure di protezione", "provvedimenti adottati nella struttura per ridurre il rischio."),
    def("LP", "protezione contro il fulmine: l'insieme di LPS e SPM usato per proteggere le strutture, i loro impianti interni, il contenuto e le persone."),
    def("ZS", "zona di una struttura: parte della struttura con caratteristiche omogenee, per la quale si usa un unico gruppo di parametri nel calcolo delle componenti di rischio."),
    def("SL", "sezione di una linea: tratto di linea con caratteristiche omogenee, per il quale si usa un unico gruppo di parametri nel calcolo delle componenti di rischio."),
    def("LPS", "sistema di protezione contro il fulmine: impianto completo (captatori, calate, dispersori, collegamenti equipotenziali e distanze di separazione) usato per ridurre il danno materiale dovuto alla fulminazione diretta della struttura."),
    def("SPM", "misure di protezione contro il LEMP: provvedimenti usati per proteggere gli impianti interni dagli effetti del LEMP."),
    def("SPD", "limitatore di sovratensione: dispositivo che limita le sovratensioni e scarica le correnti impulsive; contiene almeno un componente non lineare."),
    def("Sistema di SPD", "insieme di SPD scelti, coordinati e installati in modo da ridurre i guasti degli impianti elettrici ed elettronici."),
  ));

  // ---------- 6 Valutazione del rischio (parte generale) – CEI EN IEC 62305-2:2026-10 "Gestione del rischio"
  const si = (ok: boolean, nota = ""): Testo => (ok ? `SI${nota}` : "–");
  B.push(h1("6. Valutazione del rischio fulminazione"),
    p("La norma CEI EN IEC 62305-2:2026-10 \"Gestione del rischio\" specifica la procedura per la valutazione del rischio dovuto ai fulmini a terra e della frequenza del danno agli impianti interni e, se necessario, permette la scelta delle misure di protezione che riducono il rischio e la frequenza del danno a valori non superiori a quelli tollerabili."),
    h2("6.1 Sorgente di danno, S"),
    p("La corrente di fulmine è la sorgente del danno. Le sorgenti sono distinte in base al punto d'impatto del fulmine rispetto alla struttura considerata:"),
    el([{ t: "S1", b: true }, { t: " – fulmine sulla struttura;" }], [{ t: "S2", b: true }, { t: " – fulmine in prossimità della struttura;" }], [{ t: "S3", b: true }, { t: " – fulmine su una linea entrante nella struttura;" }], [{ t: "S4", b: true }, { t: " – fulmine in prossimità di una linea entrante nella struttura." }]),
  );
  fig(schemaSorgenti(), "Sorgenti di danno in base al punto d'impatto del fulmine (schema)");
  B.push(
    h2("6.2 Causa di danno, D"),
    p("Un fulmine può causare danni in funzione delle caratteristiche dell'oggetto da proteggere. L'edizione 2026-10 della norma distingue le seguenti cause di danno:"),
    el([{ t: "D1T", b: true }, { t: " – danno ad esseri viventi per elettrocuzione dovuta a tensioni di contatto e di passo;" }], [{ t: "D1D", b: true }, { t: " – danno ad esseri viventi colpiti direttamente dal fulmine nelle aree esposte della struttura (coperture, terrazze, aree esterne);" }], [{ t: "D2", b: true }, { t: " – danno materiale (incendio, esplosione, effetti meccanici e chimici);" }], [{ t: "D3", b: true }, { t: " – guasto degli impianti elettrici ed elettronici dovuto agli impulsi del fulmine (LEMP)." }]),
    h2("6.3 Tipo di perdita, L"),
    p("Ciascuna causa di danno, sola o in combinazione con altre, può produrre diverse perdite nell'oggetto da proteggere. Il tipo di perdita che può verificarsi dipende dalle caratteristiche dell'oggetto stesso e dal suo contenuto:"),
    el([{ t: "L1", b: true }, { t: " – perdita di vite umane (compreso danno permanente); è conseguenza delle cause D1T, D1D, D2 e, nelle strutture in cui il guasto degli impianti mette in pericolo la vita (strutture a rischio di esplosione, ospedali), anche D3;" }], [{ t: "L2", b: true }, { t: " – perdita dovuta a danni materiali alla struttura e al suo contenuto; è conseguenza della causa D2 e, nelle strutture a rischio di esplosione, anche D3;" }], [{ t: "L3", b: true }, { t: " – perdita dovuta al guasto degli impianti interni (mancata disponibilità dei servizi forniti); è conseguenza della causa D3 e si valuta con la frequenza del danno F." }]),
    p("Rispetto all'edizione 2013 non si calcolano più i rischi separati R2 (servizio pubblico), R3 (patrimonio culturale) e R4 (perdita economica): la perdita del patrimonio è coperta dalla perdita L2, la perdita di servizio pubblico dalla frequenza del danno F e dalla perdita L2."),
    h2("6.4 Rischio, R"),
    p("Il rischio R è la misura della probabile perdita media annua e deve essere valutato con riferimento alla sicurezza delle persone (perdita L1) e della struttura e del suo contenuto (perdita L2). Per la struttura, o per ciascuna sua zona di rischio, si valuta un unico rischio:"),
    p([{ t: "R = R" }, { t: "L1", sub: true }, { t: " + R" }, { t: "L2", sub: true }], { formula: true }),
    el([{ t: "R" }, { t: "L1", sub: true }, { t: " – somma delle componenti di rischio relative alla perdita di vite umane;" }], [{ t: "R" }, { t: "L2", sub: true }, { t: " – somma delle componenti di rischio relative ai danni materiali." }]),
    h2("6.5 Rischio tollerabile, RT, e frequenza tollerabile del danno, FT"),
    p("I valori del rischio tollerabile RT sono di competenza delle autorità competenti; i regolamenti nazionali o locali possono fornire indicazioni. In mancanza di indicazioni diverse si adotta il valore rappresentativo utilizzato dalla norma:"),
    el([{ t: "RT = 10" }, { t: "-5", sup: true }, { t: " anni" }, { t: "-1", sup: true }, { t: " per il rischio R di ogni zona." }]),
    p("La frequenza tollerabile del danno FT è di competenza delle autorità quando il servizio erogato è di rilevanza pubblica; negli altri casi è stabilita dal proprietario o dal gestore della struttura, in funzione della criticità degli impianti interni. Valori tipici proposti dalla norma:"),
    el([{ t: "FT = 0,1 anni" }, { t: "-1", sup: true }, { t: " per impianti interni critici nello svolgimento della loro funzione;" }], [{ t: "FT = 1 anni" }, { t: "-1", sup: true }, { t: " per impianti interni non critici." }]),
  );
  tabN("Valori tollerabili adottati (valori rappresentativi della CEI EN IEC 62305-2:2026-10)", ["Grandezza", "Valore", "Applicazione"], [
    [[{ t: "RT" }], [{ t: "10" }, { t: "-5", sup: true }, { t: " anni" }, { t: "-1", sup: true }], "Rischio R = RL1 + RL2 di ogni zona"],
    [[{ t: "FT" }], [{ t: "0,1 anni" }, { t: "-1", sup: true }], "Frequenza del danno con impianti interni critici"],
    [[{ t: "FT" }], [{ t: "1 anni" }, { t: "-1", sup: true }], "Frequenza del danno con impianti interni non critici"],
  ], [2, 3, 6]);
  if (x.rischio?.struttura.metodo === "italia") B.push(
    p([{ t: "Adattamenti nazionali (Guida CEI 81-29:2026, in vigore dal 1° novembre 2026). ", b: true }, { t: "In applicazione della deroga nazionale i rischi RL1 e RL2 sono valutati separatamente e confrontati con i rispettivi valori tollerabili: " }, { t: "RT1 = 10" }, { t: "-5", sup: true }, { t: " anni" }, { t: "-1", sup: true }, { t: " per RL1 (perdita di vite umane) e " }, { t: "RT2 = 10" }, { t: "-3", sup: true }, { t: " anni" }, { t: "-1", sup: true }, { t: " per RL2 (perdita di beni e servizi). La protezione non è necessaria se RL1 ≤ RT1 e RL2 ≤ RT2. I valori di perdita sono i valori minimi degli intervalli della norma (LT = LD = 10" }, { t: "-2", sup: true }, { t: ") e il coefficiente rp tiene conto degli impianti di spegnimento automatico e della compartimentazione antincendio." }], { allinea: "giustificato" }),
  );
  B.push(
    h2("6.6 Componenti di rischio per sorgente, causa e tipo di perdita"),
    p("Per ogni tipo di perdita (e per la frequenza del danno), nella tabella seguente sono riportate le componenti che vi contribuiscono:"),
  );
  tabN("Sorgenti, cause di danno e componenti di rischio (CEI EN IEC 62305-2:2026-10, Tab. 1)", ["Sorgente", "S1", "S1", "S1", "S1", "S2", "S3", "S3", "S3", "S4"], [
    ["Causa", "D1T", "D1D", "D2", "D3", "D3", "D1T", "D2", "D3", "D3"],
    [[{ t: "Componente", b: true }], [{ t: "RAT", b: true }], [{ t: "RAD", b: true }], [{ t: "RB", b: true }], [{ t: "RC", b: true }], [{ t: "RM", b: true }], [{ t: "RU", b: true }], [{ t: "RV", b: true }], [{ t: "RW", b: true }], [{ t: "RZ", b: true }]],
    [[{ t: "R" }, { t: "L1", sub: true }], si(true), si(true), si(true), si(true, " (a)"), si(true, " (a)"), si(true), si(true), si(true, " (a)"), si(true, " (a)")],
    [[{ t: "R" }, { t: "L2", sub: true }], si(false), si(false), si(true), si(true, " (b)"), si(true, " (b)"), si(false), si(true), si(true, " (b)"), si(true, " (b)")],
    [[{ t: "F (L3)" }], si(false), si(false), si(false), "FC", "FM", si(false), si(false), "FW", "FZ"],
  ], [1.8, 1, 1, 1, 1.1, 1.1, 1, 1, 1.1, 1.1]);
  B.push(
    p("(a) Solo per strutture in cui il guasto degli impianti interni mette in pericolo la vita umana, ad esempio strutture a rischio di esplosione e ospedali.\n(b) Solo per strutture a rischio di esplosione.", { dimensione: 8.5 }),
    h2("6.7 Metodo di valutazione"),
    p("Ai fini della valutazione del rischio si deve provvedere a:"),
    { tipo: "elenco", numerato: true, voci: ["suddividere, se necessario, la struttura in zone di rischio e individuare le linee entranti;", "determinare le componenti RAT, RAD, RB, RC, RM, RU, RV, RW e RZ di ogni zona;", "determinare il rischio R = RL1 + RL2 e confrontarlo con il rischio tollerabile RT;", "determinare la frequenza del danno F per le zone con impianti interni e confrontarla con FT."] },
    p("Per ciascuna zona della struttura devono essere effettuati i seguenti passi (vedi anche la figura successiva):"),
    { tipo: "elenco", numerato: true, voci: ["identificazione delle componenti RX che contribuiscono al rischio;", "calcolo della componente di rischio identificata RX;", "calcolo del rischio totale R;", "identificazione del rischio tollerabile RT;", "confronto del rischio R con quello tollerabile RT;", "calcolo della frequenza del danno F e confronto con FT."] },
  );
  fig(flussoValutazione(), "Procedura di valutazione del rischio e scelta delle misure di protezione (schema)");
  B.push(
    p([{ t: "Se R ≤ RT", b: true }, { t: " la protezione contro il fulmine non è necessaria per ridurre il rischio." }]),
    p([{ t: "Se R > RT", b: true }, { t: " devono essere adottate misure di protezione al fine di rendere R ≤ RT in tutte le zone della struttura." }]),
    p([{ t: "Se F > FT", b: true }, { t: " dovrebbero essere adottate misure di protezione degli impianti interni (SPM secondo la CEI EN IEC 62305-4:2026-10 e SPD della serie IEC 61643) al fine di rendere F ≤ FT; se F ≤ FT la protezione può comunque essere opportuna per ridurre la mancata disponibilità dei servizi." }]),
    p("La valutazione della convenienza economica della protezione, prevista dall'edizione 2013 con il rischio R4, non fa più parte della norma; può essere condotta a parte su richiesta del committente."),
    h2("6.8 Componenti di rischio"),
    p("Le componenti di rischio sono raggruppate secondo la sorgente e la causa di danno, come riportato nella tabella precedente. Ciascuna componente di rischio può essere calcolata mediante la seguente equazione generale:"),
    p([...pedice("R", "X"), { t: " = " }, ...pedice("N", "X"), { t: " × " }, ...pedice("P", "X"), { t: " × " }, ...pedice("L", "X")], { formula: true }),
    p("dove:"),
    el([...pedice("N", "X"), { t: " è il numero di eventi pericolosi all'anno [Allegato A, CEI EN IEC 62305-2:2026-10];" }], [...pedice("P", "X"), { t: " è la probabilità di danno [Allegato B, CEI EN IEC 62305-2:2026-10];" }], [...pedice("L", "X"), { t: " è l'entità della perdita conseguente [Allegato C, CEI EN IEC 62305-2:2026-10]." }]),
  );
  const ND = (): Testo => [...pedice("N", "D"), { t: " – numero di eventi pericolosi per fulminazione diretta della struttura [Allegato A];" }];
  const NLD = (): Testo => [...pedice("N", "L"), { t: " – numero di eventi pericolosi per fulminazione sulla linea [Allegato A];" }];
  const NDJ = (): Testo => [...pedice("N", "DJ"), { t: " – numero di eventi pericolosi per fulminazione diretta della struttura adiacente all'estremità della linea [Allegato A];" }];
  const componente = (titoloC: string, testo: string, formula: Run[], dove: Testo[]) => B.push(h3(titoloC), p(testo), p(formula, { formula: true }), p("dove:"), el(...dove));
  componente("Componente di rischio (danno ad esseri viventi per tensioni di contatto e di passo – fulmine sulla struttura), RAT",
    "Componente relativa ai danni ad esseri viventi dovuti a tensioni di contatto e di passo all'interno della struttura e nelle zone fino a 3 m all'esterno di essa. Contribuisce alla perdita L1 (perdita di vite umane).",
    [...pedice("R", "AT"), { t: " = " }, ...pedice("N", "D"), { t: " × " }, ...pedice("P", "AT"), { t: " × " }, ...pedice("L", "AT")],
    [ND(), [...pedice("P", "AT"), { t: " – probabilità di danno ad esseri viventi per tensioni di contatto e di passo, che tiene conto delle misure di protezione e del tipo di suolo o pavimento [Allegato B];" }], [...pedice("L", "AT"), { t: " – perdita per persone ferite da tensioni di contatto e di passo (LT) [Allegato C]." }]]);
  componente("Componente di rischio (danno ad esseri viventi colpiti direttamente – fulmine sulla struttura), RAD",
    "Componente relativa ai danni ad esseri viventi colpiti direttamente dal fulmine nelle aree esposte della struttura (coperture accessibili, terrazze, aree esterne). Contribuisce alla perdita L1. È nulla se nella zona non sono presenti persone esposte.",
    [...pedice("R", "AD"), { t: " = " }, ...pedice("N", "D"), { t: " × " }, ...pedice("P", "AD"), { t: " × " }, ...pedice("L", "AD")],
    [ND(), [...pedice("P", "AD"), { t: " – probabilità di danno ad esseri viventi colpiti direttamente nelle aree esposte [Allegato B];" }], [...pedice("L", "AD"), { t: " – perdita per persone ferite da fulmini diretti (LD) [Allegato C]." }]]);
  componente("Componente di rischio (danno materiale alla struttura – fulmine sulla struttura), RB",
    "Componente relativa ai danni materiali causati da scariche pericolose all'interno della struttura che innescano l'incendio e l'esplosione e che possono essere pericolose anche per l'ambiente. Contribuisce alle perdite L1 (perdita di vite umane) e L2 (danno materiale alla struttura e al contenuto).",
    [...pedice("R", "B"), { t: " = " }, ...pedice("N", "D"), { t: " × " }, ...pedice("P", "B"), { t: " × " }, ...pedice("L", "B")],
    [ND(), [...pedice("P", "B"), { t: " – probabilità di danno materiale in una struttura (fulmine sulla struttura), che tiene conto della classe dell'LPS, delle misure antincendio rp e del rischio d'incendio rf [Allegato B];" }], [...pedice("L", "B"), { t: " – perdita per danno materiale (LF1 per le persone, LF2 per la struttura e il contenuto) [Allegato C]." }]]);
  componente("Componente di rischio (guasto di impianti interni – fulmine sulla struttura), RC",
    "Componente relativa al guasto di impianti interni causato dal LEMP (impulso elettromagnetico del fulmine). Entra nel rischio di perdita di vite umane L1 nelle strutture in cui il guasto degli impianti interni mette in pericolo la vita (strutture a rischio di esplosione, ospedali) e nel rischio L2 nelle strutture a rischio di esplosione. In tutti i casi contribuisce alla frequenza del danno F (FC).",
    [...pedice("R", "C"), { t: " = " }, ...pedice("N", "D"), { t: " × " }, ...pedice("P", "C"), { t: " × " }, ...pedice("L", "C")],
    [ND(), [...pedice("P", "C"), { t: " – probabilità di guasto di un impianto interno (fulmine sulla struttura), che tiene conto del sistema di SPD coordinati [Allegato B];" }], [...pedice("L", "C"), { t: " – perdita per guasto di un impianto interno (LO1, LO2) [Allegato C]." }]]);
  componente("Componente di rischio (guasto di impianti interni – fulmine in prossimità della struttura), RM",
    "Componente relativa al guasto di impianti interni causato dal LEMP di un fulmine che cade in prossimità della struttura. Vale quanto detto per RC; contribuisce alla frequenza del danno F (FM).",
    [...pedice("R", "M"), { t: " = " }, ...pedice("N", "M"), { t: " × " }, ...pedice("P", "M"), { t: " × " }, ...pedice("L", "M")],
    [[...pedice("N", "M"), { t: " – numero di eventi pericolosi per fulminazione in prossimità della struttura [Allegato A];" }], [...pedice("P", "M"), { t: " – probabilità di guasto di un impianto interno (fulmine in prossimità della struttura) [Allegato B];" }], [...pedice("L", "M"), { t: " – perdita per guasto di un impianto interno [Allegato C]." }]]);
  componente("Componente di rischio (danno ad esseri viventi – fulmine su una linea entrante), RU",
    "Componente relativa ai danni ad esseri viventi dovuti a tensioni di contatto all'interno della struttura causate dalla corrente di fulmine iniettata nella linea entrante. Contribuisce alla perdita L1.",
    [...pedice("R", "U"), { t: " = (" }, ...pedice("N", "L"), { t: " + " }, ...pedice("N", "DJ"), { t: ") × " }, ...pedice("P", "U"), { t: " × " }, ...pedice("L", "U")],
    [NLD(), NDJ(), [...pedice("P", "U"), { t: " – probabilità di danno ad esseri viventi (fulmine sulla linea), che tiene conto degli SPD per il collegamento equipotenziale [Allegato B];" }], [...pedice("L", "U"), { t: " – perdita per persone ferite da tensioni di contatto (LT) [Allegato C]." }]]);
  componente("Componente di rischio (danno materiale alla struttura – fulmine su una linea entrante), RV",
    "Componente relativa ai danni materiali (incendio o esplosione innescati da scariche pericolose fra installazioni esterne e parti metalliche, generalmente nel punto d'ingresso della linea nella struttura) dovuti alla corrente di fulmine trasmessa attraverso la linea entrante. Contribuisce alle perdite L1 e L2.",
    [...pedice("R", "V"), { t: " = (" }, ...pedice("N", "L"), { t: " + " }, ...pedice("N", "DJ"), { t: ") × " }, ...pedice("P", "V"), { t: " × " }, ...pedice("L", "V")],
    [NLD(), NDJ(), [...pedice("P", "V"), { t: " – probabilità di danno materiale nella struttura (fulmine sulla linea) [Allegato B];" }], [...pedice("L", "V"), { t: " – perdita per danno materiale (LF1, LF2) [Allegato C]." }]]);
  componente("Componente di rischio (guasto di impianti interni – fulmine su una linea entrante), RW",
    "Componente relativa al guasto di impianti interni causato da sovratensioni trasmesse dalla linea alla struttura. Vale quanto detto per RC riguardo alle perdite L1 e L2; contribuisce alla frequenza del danno F (FW).",
    [...pedice("R", "W"), { t: " = (" }, ...pedice("N", "L"), { t: " + " }, ...pedice("N", "DJ"), { t: ") × " }, ...pedice("P", "W"), { t: " × " }, ...pedice("L", "W")],
    [NLD(), NDJ(), [...pedice("P", "W"), { t: " – probabilità di guasto di un impianto interno (fulmine sulla linea) [Allegato B];" }], [...pedice("L", "W"), { t: " – perdita per guasto di un impianto interno [Allegato C]." }]]);
  componente("Componente di rischio (guasto di impianti interni – fulmine in prossimità di una linea entrante), RZ",
    "Componente relativa al guasto di impianti interni causato da sovratensioni indotte sulla linea e trasmesse alla struttura. Vale quanto detto per RC riguardo alle perdite L1 e L2; contribuisce alla frequenza del danno F (FZ).",
    [...pedice("R", "Z"), { t: " = " }, ...pedice("N", "I"), { t: " × " }, ...pedice("P", "Z"), { t: " × " }, ...pedice("L", "Z")],
    [[...pedice("N", "I"), { t: " – numero di eventi pericolosi per fulminazione in prossimità della linea [Allegato A];" }], [...pedice("P", "Z"), { t: " – probabilità di guasto di un impianto interno (fulmine in prossimità della linea) [Allegato B];" }], [...pedice("L", "Z"), { t: " – perdita per guasto di un impianto interno [Allegato C]." }]]);
  B.push(h2("6.9 Determinazione del rischio, R"),
    p("Il rischio relativo alla perdita di vite umane è determinato come somma delle componenti di rischio precedentemente definite:"),
    p([{ t: "R" }, { t: "L1", sub: true }, { t: " = RAT + RAD + RB + RC" }, { t: "(a)", sup: true }, { t: " + RM" }, { t: "(a)", sup: true }, { t: " + RU + RV + RW" }, { t: "(a)", sup: true }, { t: " + RZ" }, { t: "(a)", sup: true }], { formula: true }),
    p("(a) Solo per strutture in cui il guasto degli impianti interni mette in pericolo la vita umana (strutture a rischio di esplosione, ospedali).", { dimensione: 9 }),
    p("Il rischio relativo ai danni materiali alla struttura e al suo contenuto è determinato dalla formula:"),
    p([{ t: "R" }, { t: "L2", sub: true }, { t: " = RB + RC" }, { t: "(b)", sup: true }, { t: " + RM" }, { t: "(b)", sup: true }, { t: " + RV + RW" }, { t: "(b)", sup: true }, { t: " + RZ" }, { t: "(b)", sup: true }], { formula: true }),
    p("(b) Solo per strutture a rischio di esplosione.", { dimensione: 9 }),
    p([{ t: "Il rischio della zona è R = R" }, { t: "L1", sub: true }, { t: " + R" }, { t: "L2", sub: true }, { t: ". Se il danno può coinvolgere l'ambiente o le strutture circostanti (esplosione, rilascio di sostanze pericolose) si considerano anche le indicazioni dell'Allegato E della norma." }]),
    h2("6.10 Determinazione della frequenza del danno, F"),
    p("La frequenza del danno F (perdita L3) si valuta per gli impianti interni o le apparecchiature che il proprietario vuole proteggere, in ciascuna zona dove sono presenti; sostituisce la valutazione dei rischi di perdita di servizio pubblico (R2) e di perdita economica (R4) dell'edizione 2013:"),
    p([{ t: "F = F" }, { t: "C", sub: true }, { t: " + F" }, { t: "M", sub: true }, { t: " + F" }, { t: "W", sub: true }, { t: " + F" }, { t: "Z", sub: true }], { formula: true }),
    p("dove (CEI EN IEC 62305-2:2026-10, Tab. 4):"),
    el([...pedice("F", "C"), { t: " = ND × PC × Pe – guasto degli impianti interni per fulmine sulla struttura;" }], [...pedice("F", "M"), { t: " = NM × PM × Pe – guasto per fulmine in prossimità della struttura;" }], [...pedice("F", "W"), { t: " = (NL + NDJ) × PW × Pe – guasto per fulmine su una linea entrante;" }], [...pedice("F", "Z"), { t: " = NI × PZ × Pe – guasto per fulmine in prossimità di una linea entrante;" }], [{ t: "Pe – fattore che tiene conto del tempo di presenza delle apparecchiature nella zona (te/8 760)." }]),
    h2("6.11 Esito della valutazione"),
    p("Una volta noti i valori di rischio e di frequenza del danno per la struttura bisogna verificare che essi siano non superiori ai valori tollerabili."),
    p([{ t: "Caso 1 – Struttura autoprotetta", b: true, colore: OBO.sec2 }]),
    p("Se per ogni zona R ≤ RT e F ≤ FT senza misure di protezione, la struttura oggetto di verifica può considerarsi \"autoprotetta\"."),
    p([{ t: "Caso 2 – Struttura protetta", b: true, colore: OBO.sec2 }]),
    p("Se per ogni zona R ≤ RT e F ≤ FT con le misure di protezione adottate, la struttura oggetto di verifica può considerarsi \"protetta\"."),
    p([{ t: "Caso 3 – Struttura NON protetta", b: true, colore: OBO.sec2 }]),
    p("Se in almeno una zona R > RT o F > FT devono essere adottate ulteriori misure di protezione al fine di riportare i valori entro quelli tollerabili."),
  );

  // ---------- 7 LPS esterno
  const IMIN: Record<Lpl, number> = { I: 3, II: 5, III: 10, IV: 16 };
  const col = LIVELLI.indexOf(lpl) + 1;
  B.push(h1("7. Protezione contro le scariche atmosferiche (LPS esterno) – Lightning Protection System"),
    p("L'LPS esterno ha come ruolo fondamentale quello di intercettare i fulmini prima che entrino nella struttura. La corrente associata al fenomeno di fulminazione, quando esso interessa una struttura metallica collegata a terra, è costretta a fluire sulla stessa fino al terreno; si può dunque assumere in prima approssimazione che l'LPS svolga la funzione di disperdere la corrente di fulmine nel terreno, evitando così che si verifichino danni di tipo meccanico o chimico e scariche pericolose che possano innescare incendi."),
    p("L'impianto di protezione contro i fulmini LPS si compone essenzialmente di:"),
    el("un impianto esterno, costituito da captatori (che intercettano i fulmini diretti sulla struttura);", "calate (che conducono a terra senza danni la corrente di fulmine);", "dispersori (che disperdono a terra tale corrente)."),
    p("Forma, sezione e dimensioni dei conduttori e delle maglie dei captatori, dei conduttori di discesa e del numero dei dispersori si riferiscono alla norma CEI EN IEC 62305-3:2026-10 e ai componenti della serie CEI EN IEC 62561."),
    p("L'idoneità dell'LPS deve essere verificata in conformità alla norma CEI EN IEC 62305-2:2026-10."),
    h2("7.1 Impianto di captazione"),
    p("Il posizionamento del sistema di captatori è considerato adeguato quando la struttura che deve essere protetta risulta interamente all'interno del volume protetto dal sistema di captatori. L'impianto di captazione secondo il metodo della sfera rotolante (integrato, dove serve, dal metodo della maglia) prevede l'installazione di una rete di captatori secondo lo schema seguente:"),
  );
  tabN("Parametri della corrente di fulmine e criteri di intercettazione per LPL (CEI EN IEC 62305-1:2026-10, Tab. 3 e 4; CEI EN IEC 62305-3:2026-10, Tab. 2)", ["Criteri di intercettazione", "I", "II", "III", "IV"], [
      ["Massimo valore della corrente di picco I (kA)", ...LIVELLI.map((l) => String(CORRENTE_LPL[l]))],
      ["Minimo valore della corrente di picco I (kA)", ...LIVELLI.map((l) => String(IMIN[l]))],
      ["Raggio della sfera rotolante R (m)", ...LIVELLI.map((l) => String(par[l]!.raggio))],
      [[{ t: "Lato maglia W" }, { t: "m", sub: true }, { t: " (m)" }], ...LIVELLI.map((l) => `${par[l]!.latoMaglia} × ${par[l]!.latoMaglia}`)],
    ], [5, 1.5, 1.5, 1.5, 1.5], col);
  fig(curvaCorrente(lpl, IMIN[lpl], CORRENTE_LPL[lpl]), `Probabilità che il valore di picco della corrente di fulmine superi I (valori della CEI EN IEC 62305-1:2026-10, Tab. A.3) con i limiti dell'LPL ${lpl}`);
  B.push(
    p(`Per il presente progetto (LPL ${lpl}, colonna evidenziata): raggio della sfera rotolante ${R} m, lato della maglia ${par[lpl]!.latoMaglia} m.`, { grassetto: true }),
    p("La norma CEI EN IEC 62305-1:2026-10 definisce i valori minimi dei parametri del fulmine e i relativi raggi massimi della sfera rotolante corrispondenti ai diversi livelli di protezione in funzione non della carica, ma della corrente di fulmine."),
    p("Data una carica elettrica (la testa del futuro fulmine) in un mezzo dielettrico omogeneo, la sfera con il centro sulla stessa carica è il luogo geometrico dei punti che hanno la stessa probabilità di scarica. Il raggio della sfera è funzione, oltre che della probabilità di scarica, anche del valore della carica:"),
    p("R = f(Pr, Q)", { formula: true }),
    el("R – raggio della sfera;", "Pr – probabilità di scarica;", "Q – carica elettrica."),
    p("Il metodo della sfera rotolante prevede il posizionamento dei captatori in modo tale da massimizzare la probabilità che la sfera così descritta abbia il suo punto di contatto con le aste di captazione, in modo da incanalare la scarica elettrica attraverso la maglia di conduzione verso i dispersori di terra."),
    p("Tutti i punti toccati dalla sfera sono quelli che per primi sarebbero oggetto di fulminazione e come tali devono essere protetti con un captatore che, toccato per primo dalla sfera, diventa il punto di impatto del fulmine. Tra due captatori la sfera penetra verso la copertura per una profondità p che dipende dal raggio R e dalla distanza d tra i captatori:"),
    p([{ t: "p = R − √(R² − (d/2)²)" }], { formula: true }),
    p("I componenti naturali costituiti da elementi metallici che sono parte integrante della struttura e che non possono essere modificati facilmente possono essere usati come elementi dell'LPS. Se adeguatamente dimensionati, possono essere usati come componenti naturali del sistema di captatori e, quindi, entrare a far parte dell'LPS i seguenti elementi di una struttura:"),
    el("lastre metalliche di copertura, con gli spessori minimi della tabella seguente;", "componenti metallici costruttivi di tetti (capriate metalliche, ecc.) al di sotto di una copertura non metallica, purché sia accettabile il danneggiamento di quest'ultima;", "parti metalliche come gronde, ornamenti, ringhiere;", "tubazioni e serbatoi metallici sul tetto."),
  );
  tabN("Spessore minimo di lastre e tubazioni metalliche usate come captatori naturali (CEI EN IEC 62305-3:2026-10, Tab. 3)", ["Materiale", "Spessore t (mm) – senza perforazione", "Spessore t' (mm) – perforazione ammessa"], SPESSORI_LASTRE.map((z) => [NOMI_MATERIALI[z.materiale], z.t != null ? it(z.t) : "—", it(z.t1)]), [4, 4, 4]);
  B.push(p("t: spessore che evita la perforazione o il surriscaldamento nel punto d'impatto, richiesto se sotto la lastra c'è materiale infiammabile; t': spessore minimo quando la perforazione è accettabile.", { dimensione: 8.5 }),
    p("Gli impatti laterali sulle facciate sono considerati trascurabili per strutture fino a 60 m di altezza dal suolo; anche in questo caso, però, possono essere a rischio gli elementi che sporgono in modo significativo dalla facciata (balconi, telecamere, antenne). Su strutture più alte di 60 m il sistema di captatori deve proteggere anche le sporgenze e le apparecchiature sulle superfici verticali della parte sommitale, tipicamente il 20 % superiore dell'altezza; per le parti di questo 20 % che non superano i 60 m dal suolo la protezione della superficie verticale è facoltativa (CEI EN IEC 62305-3:2026-10, 5.2.3)."),
    p("Se il tetto è di materiale non combustibile (classi A1, A2) i captatori possono essere appoggiati sulla copertura; se è di materiale normalmente combustibile possono esservi posati solo se il loro riscaldamento al passaggio della corrente di fulmine non è pericoloso per il materiale; con materiali facilmente infiammabili va mantenuta un'adeguata distanza tra copertura e conduttori (5.2.4)."),
    p("La ripartizione della corrente di fulmine sui captatori dipende dal tipo e dal numero degli stessi così come dal numero totale e dal sistema delle calate e dei dispersori. Il punto di impatto è sempre interessato dalla corrente totale indipendentemente dal tipo di captatore e da tutto il resto. Pertanto, un captatore che è colpito da fulmine viene percorso dalla corrente totale; questa corrente poi si ripartisce lungo il sistema secondo il numero di nodi che incontra lungo il percorso verso il dispersore di terra. Per il dimensionamento dei conduttori va fatto necessariamente riferimento al caso più gravoso."),
    p("Nell'installazione dei captatori deve essere mantenuta una distanza minima rispetto a corpi metallici, impianti elettrici, di telecomunicazione e di segnale. Quando la corrente di fulmine percorre l'LPS si manifestano infatti delle cadute di tensione longitudinali che sollecitano l'eventuale isolamento tra detto elemento e le parti che lo circondano."),
    p("Per evitare l'equipotenzializzazione, soluzione da percorrere se non si hanno alternative, occorre prevedere una base del captatore isolante sufficiente a garantire il rispetto della distanza di sicurezza dielettrica, un captatore isolato (es. isFang con conduttore isCon) o un maggiore numero di calate."),
    p("Il calcolo della distanza minima di sicurezza (distanza di separazione s) deve essere condotto facendo riferimento al primo punto equipotenziale con uno dei metodi indicati dalla norma CEI EN IEC 62305-3:2026-10 (vedi capitolo 13)."),
    p("Va inoltre ricordato che sui tetti piani durante i temporali è previsto un certo accumulo di acqua: per non perdere di efficacia, il sistema di captatori deve essere installato al di sopra del massimo livello probabile dell'acqua. I conduttori e le aste dell'LPS devono essere fissati meccanicamente in modo sicuro, così da resistere alle sollecitazioni dovute al vento, agli agenti atmosferici e ai lavori eseguiti sulla copertura; la distanza tra gli elementi di fissaggio va scelta in funzione del tipo di conduttore (indicativamente 1 m) e ridotta quando si usano conduttori di sezione ridotta."),
  );
  const dist = (distanzaCalate as unknown as Record<string, { distanzaTipica: number }>)[lpl]?.distanzaTipica ?? 0;
  B.push(h2("7.2 Calate"),
    p("Il sistema delle calate è la parte di LPS esterno destinata alla conduzione della corrente di fulmine dal sistema di captatori al sistema di dispersori."),
    p("Il sistema delle calate comprende in alcuni casi anche dei collegamenti intermedi con lo scopo di:"),
    el("equipotenzializzare, quando la distanza con le parti conduttrici della struttura non garantisce la tenuta dielettrica (mancato rispetto della distanza di sicurezza);", "distribuire la corrente di fulmine tra le calate stesse per mezzo di conduttori ad anello (conduttori disposti ad anello attorno alla struttura che interconnettono le calate per favorire la ripartizione della corrente di fulmine fra esse)."),
    p("Il numero di calate dipende dalla dimensione perimetrale del tetto. La disposizione delle calate deve essere eseguita in modo che, partendo dagli angoli della struttura, le calate siano distribuite il più uniformemente possibile su tutto il perimetro, in modo da costituire la continuazione dei conduttori dal sistema di captazione e da assicurare il più breve e più diretto percorso fino a terra."),
    p("Se la corrente di fulmine è ripartita su diverse calate, è intuitivo comprendere che il rischio di scariche laterali e di disturbi elettromagnetici all'interno della struttura si riduce. Per ridurre la probabilità che la corrente di fulmine attraverso l'LPS provochi un danno, è quindi opportuno che le calate siano disposte in modo parallelo e simmetrico e che le lunghezze dei percorsi siano ridotte al minimo."),
    p("Il numero di calate di un LPS non isolato non deve essere inferiore a due. A seconda della struttura (ad esempio portoni, prefabbricati in calcestruzzo) le distanze tra le varie calate possono variare: è accettabile una variazione del 25 % della spaziatura, a patto che il valore medio rispetti la Tabella 5. Se su un lato non è possibile installare calate, quelle mancanti si dispongono come calate addizionali sugli altri lati, a distanza tra loro non inferiore a un terzo dei valori della tabella. Nei cortili con perimetro maggiore di 30 m dovrebbero essere installate calate."),
    p("Nella norma CEI EN IEC 62305-3:2026-10 (Tab. 5) sono indicati i valori preferenziali della distanza tra le calate in funzione della classe dell'LPS:"),
  );
  tabN("Valori preferenziali della distanza tra le calate in funzione della classe dell'LPS (CEI EN IEC 62305-3:2026-10, Tab. 5)", ["Classe dell'LPS", "I", "II", "III", "IV"], [["Distanza (m)", ...LIVELLI.map((l) => String((distanzaCalate as unknown as Record<string, { distanzaTipica: number }>)[l]?.distanzaTipica ?? "—"))]], [5, 1.5, 1.5, 1.5, 1.5], col);
  B.push(
    p("La disposizione delle calate deve essere tale che:"),
    el("gli impianti di protezione ad aste abbiano almeno una calata in corrispondenza di ogni asta;", "gli impianti di protezione a funi abbiano almeno una calata in corrispondenza di entrambe le estremità di ogni fune;", `gli impianti di protezione a maglia abbiano calate periferiche, con un minimo di 2, disposte con il passo della tabella precedente (${dist} m per LPL ${lpl}) misurato lungo il perimetro.`),
    p("Se possibile, deve essere installata una calata in corrispondenza di ogni spigolo della struttura. La ripartizione della corrente migliora aumentando non solo il numero di calate ma anche quello dei conduttori ad anello che le interconnettono; la disposizione di calate e anelli influenza il valore della distanza di separazione (vedi 13.3)."),
    p("Le calate devono, per quanto possibile, essere disposte in prosecuzione diretta degli organi di captazione e, per impianti di protezione a maglia, in corrispondenza di nodi, vicino agli spigoli ed equidistanti fra loro."),
    p("Le calate devono essere installate il più possibile diritte e verticali, possibilmente distanti da porte e finestre e dagli impianti interni; se si formano anse, la distanza tra due punti qualsiasi dell'ansa non deve essere inferiore alla distanza di separazione. Le calate, anche se isolate, non devono essere installate all'interno di grondaie o pluviali. Ogni calata deve avere un giunto di sezionamento per le misure, salvo che si utilizzino calate naturali."),
    p("Nei punti di incrocio con le calate, i pluviali in metallo devono essere collegati con le calate. I pluviali in metallo, anche se non utilizzati come calate, sono da collegare alla base con il sistema equipotenziale oppure con l'impianto di terra."),
  );
  const rame = SEZIONI_EQUIPOTENZIALI.rame;
  B.push(h2("7.3 Materiali e dimensioni minime per organi di captazione e di calata"),
    p("I materiali, le configurazioni, le minime sezioni dei conduttori e delle aste dei captatori sono definiti dalla Tabella 7 della norma CEI EN IEC 62305-3:2026-10, di cui si riportano i valori principali:"),
  );
  tabN("Materiale, configurazione e sezione minima di captatori, aste e calate (CEI EN IEC 62305-3:2026-10, Tab. 7)", ["Materiale", "Configurazione", "Sezione minima (mm²)"], SEZIONI_CAPTATORI_CALATE.filter((z) => ["rame", "alluminio", "acciaio-zincato", "acciaio-inox"].includes(z.materiale)).map((z) => [NOMI_MATERIALI[z.materiale], NOMI_CONFIGURAZIONI[z.configurazione], String(z.sezione)]), [4, 5, 2]);
  B.push(
    p([{ t: "Verranno utilizzati per gli organi di captazione e di calata conduttori tondi in alluminio o in acciaio zincato a caldo da 50 mm² (diametro 8 mm)" }, ...(() => { const m = [...new Set(x.conduttori.filter((c) => c.tipo !== "terra").map((c) => [c.materiale, c.sezione ? `${c.sezione}${/^\d+$/.test(c.sezione) ? " mm²" : ""}` : ""].filter(Boolean).join(" ")).filter(Boolean))]; return m.length ? [{ t: `; nel progetto: ${m.join(", ")}` }] : []; })(), { t: "." }]),
    p("Questi requisiti risultano dalla conduttività elettrica dei materiali utilizzati per condurre la corrente di fulmine (aumento di temperatura) e dalle sollecitazioni meccaniche durante l'utilizzo."),
    p("Secondo le note della Tabella 7: la sezione di 50 mm² (Ø 8 mm) può essere ridotta a 28 mm² (Ø 6 mm) dove la resistenza meccanica non è un requisito essenziale, riducendo in questo caso la distanza tra gli elementi di fissaggio; per le aste di captazione per cui il carico del vento non è critico si può utilizzare un'asta di Ø 9,5 mm lunga 1 m. Nel dimensionamento delle aste di captazione si deve tenere conto delle condizioni ambientali, in particolare del carico di vento previsto. Le caratteristiche meccaniche, elettriche e di resistenza alla corrosione devono soddisfare la CEI EN IEC 62561-2."),
  );
  tabN("Sezione minima dei conduttori equipotenziali (CEI EN IEC 62305-3:2026-10, Tab. 9 e 10)", ["Materiale", "Tra le barre equipotenziali o verso terra (mm²)", "Verso le masse metalliche interne (mm²)"], (["rame", "alluminio", "acciaio"] as const).map((m) => [m.charAt(0).toUpperCase() + m.slice(1), String(SEZIONI_EQUIPOTENZIALI[m].traBarre), String(SEZIONI_EQUIPOTENZIALI[m].corpiInterni)]), [3, 5, 5]);
  B.push(
    p(`Secondo le Tabelle 9 e 10 della norma CEI EN IEC 62305-3:2026-10, la sezione minima richiesta per un conduttore di collegamento tra barre equipotenziali, o verso l'impianto di terra, è ${rame.traBarre} mm² in rame (${SEZIONI_EQUIPOTENZIALI.alluminio.traBarre} mm² in alluminio, ${SEZIONI_EQUIPOTENZIALI.acciaio.traBarre} mm² in acciaio); verso le masse metalliche interne è ${rame.corpiInterni} mm² in rame. Sarebbe quindi possibile utilizzare un cavo in rame isolato in PVC NYY 1 × 16 mm², provato con corrente impulsiva di 100 kA (10/350 µs), come calata oppure come conduttore fuori terra e interrato.`),
  );

  // =====================================================================================
  // PARTE 2 – VALUTAZIONE DEL RISCHIO E SCELTA DELLE MISURE DI PROTEZIONE
  // =====================================================================================
  B.push({ tipo: "salto" });
  copertina("Relazione tecnica impianto di protezione\ndalle scariche atmosferiche", "Valutazione del rischio e scelta delle misure di protezione");

  B.push(h1("8. Contenuto del documento"),
    p("Questo documento contiene:"),
    el("la relazione sulla valutazione dei rischi dovuti al fulmine;", "la scelta delle misure di protezione da adottare ove necessarie, coordinate con il risultato della verifica."),
    h1("9. Norme tecniche di riferimento"),
    p("Questo documento è stato elaborato con riferimento alle seguenti norme:"),
    el("CEI EN IEC 62305-1:2026-10 – \"Protezione contro i fulmini. Parte 1: Principi generali\";", "CEI EN IEC 62305-2:2026-10 – \"Protezione contro i fulmini. Parte 2: Gestione del rischio\";", "CEI EN IEC 62305-3:2026-10 – \"Protezione contro i fulmini. Parte 3: Danno materiale alle strutture e pericolo per le persone\";", "CEI EN IEC 62305-4:2026-10 – \"Protezione contro i fulmini. Parte 4: Impianti elettrici ed elettronici nelle strutture\";", "CEI 81-29 – \"Linee guida per l'applicazione delle norme CEI EN 62305\";", "CEI EN IEC 62858 – \"Densità di fulminazione. Reti di localizzazione fulmini (LLS) – Principi generali\"."),
  );

  // densità
  const k = x.rischio?.struttura.k ?? 2;
  B.push(h1("10. Densità annua di fulmini a terra"),
    p("La densità annua di fulmini a terra al kilometro quadrato nella posizione in cui è ubicata la struttura vale:"),
    p([{ t: `NG = ${it(d.densita)}  –  NSG = ${it(r.nsgAttestato ?? k * d.densita)}`, b: true, i: true }, { t: "  fulmini/(anno·km²)", i: true }], { allinea: "centro" }),
    p([{ t: `NSG è la densità dei punti di impatto al suolo; se il fornitore dei dati non indica il rapporto k = NSG/NG si assume k = 2 (CEI EN IEC 62305-2:2026-10, A.1). Nel progetto k = ${it(k)}. ` }, ...(r.ngFornitore ? [{ t: `I valori sono quelli dell'attestato ${r.ngFornitore}${r.ngData ? ` del ${dataIt(r.ngData)}` : ""}${r.nsgAttestato != null ? ` (NSG da attestato = ${it(r.nsgAttestato)})` : ""}, allegato alla relazione (capitolo 17).` }] : [dc("fornitore e data dell'attestato NG/NSG (Dati della relazione)")])]),
  );

  // struttura
  const pos = fattori.find((f) => f.id === d.posizioneId);
  B.push(h1("11. Individuazione della struttura da proteggere"),
    p([{ t: "La struttura che si vuole proteggere coincide con " }, ...(titolo ? [{ t: `«${titolo}»` }] : [dc("edifici da proteggere")]), { t: ", rappresentata nei disegni allegati." }]),
    p("La struttura e le sue zone sono state definite tenuto conto di:"),
    el("compartimenti antincendio esistenti e/o che sarebbe opportuno realizzare;", "eventuali locali già protetti (e/o che sarebbe opportuno proteggere specificamente) contro il LEMP (impulso elettromagnetico);", "i tipi di superficie del suolo all'esterno della struttura, i tipi di pavimentazione interni ad essa e l'eventuale presenza di persone;", "le altre caratteristiche della struttura e, in particolare, il lay-out degli impianti interni e le misure di protezione esistenti."),
    p("Pertanto, ai sensi dell'Allegato A della norma CEI EN IEC 62305-2:2026-10, le dimensioni e le caratteristiche della struttura da considerare sono quelle dell'edificio stesso:"),
    tab(["Dato", "Valore"], [
      ["Ubicazione", [[comuneNome, provincia ? `(${provincia})` : ""].filter(Boolean).join(" "), d.indirizzo ?? ""].filter(Boolean).join(", ") || "—"],
      ...(typeof d.lat === "number" && typeof d.lon === "number" ? [["Coordinate (WGS84)", `${d.lat.toFixed(6).replace(".", ",")}° N, ${d.lon.toFixed(6).replace(".", ",")}° E`] as Testo[]] : []),
      ["Destinazione d'uso", destinazione],
      ["Dimensioni di ingombro L × W × H", d.L > 0 ? `${it(d.L)} × ${it(d.W)} × ${it(d.H)} m` : [dc("dimensioni")]],
      ["Copertura", d.copertura], ["Struttura", d.materiale], ["Impianti in copertura", d.impiantiTetto ? "Sì" : "No"],
      ["Posizione relativa (CD)", pos ? `${pos.descrizione} (CD = ${it(pos.valore)})` : "—"],
    ], [4, 8]),
  );
  tabN("Fattore di posizione CD (CEI EN IEC 62305-2:2026-10, Tab. A.1) – riga del progetto evidenziata", ["Posizione relativa della struttura", "CD"], fattori.map((f) => [f.descrizione, it(f.valore)]), [9, 2]);
  { const b = B.pop()!; B.push(evid(b, [fattori.findIndex((f) => f.id === d.posizioneId)])); }
  if (corpi.length > 1) B.push(p(`La struttura può essere semplificata e descritta come formata da ${corpi.length} blocchi${corpi.every((c) => c.impronta.length === 4) ? " di forma rettangolare" : ""} intersecati e contigui tra loro, numerati nello schema a blocchi seguente:`));
  corpi.forEach((c, i) => {
    const xs = c.impronta.map((q) => q[0]), ys = c.impronta.map((q) => q[1]);
    const a = Math.max(...xs) - Math.min(...xs), b = Math.max(...ys) - Math.min(...ys);
    const dp = r.corpi[c.id]?.altezzaDaProteggere, nota = r.corpi[c.id]?.nota, metallica = r.corpi[c.id]?.metallica;
    B.push(h3(`Blocco ${i + 1}${c.nome ? ` – ${c.nome}` : ""}`), p(`${c.nome || `Il blocco ${i + 1}`} ha dimensioni planari di ${it(Math.max(a, b), 1)} m × ${it(Math.min(a, b), 1)} m (${c.impronta.length === 4 ? "pianta rettangolare" : `pianta di ${c.impronta.length} lati`}), un'area di ${it(areaPoligono(c.impronta), 0)} m², un perimetro di ${it(perimetro(c.impronta), 1)} m e un'altezza di gronda di ${it(c.quotaBase + c.altezzaGronda, 2)} m${c.tipoTetto === "falde" ? `, con copertura a falde e colmo a ${it(c.quotaBase + c.altezzaColmo, 2)} m` : c.tipoTetto === "piano" ? ", con copertura piana" : ""}.${dp != null ? ` Sul tetto va protetta un'altezza di ${it(dp, 1)} m (impianti e strutture in copertura).` : ""}${nota ? ` ${nota}` : ""}`));
    if (metallica) B.push(p(`${c.nome || `Il blocco ${i + 1}`} è una sovrastruttura metallica in copertura: va collegata all'impianto di captazione (collegamento equipotenziale con morsetti adatti al materiale) e, se lo spessore delle lamiere e dei profili rispetta i valori minimi della CEI EN IEC 62305-3:2026-10 (Tab. 3), può essere usata come captatore naturale; altrimenti va protetta con la captazione di progetto.`));
  });
  if (corpi.length) fig(schemaBlocchi(verifiche.map((v) => ({ corpo: v.corpo, numero: v.numero, daProteggere: v.daProteggere })), x.aste.map((a) => ({ x: a.x, y: a.y, tipo: tipi.get(a.id) ?? "fissa" })), NOME_BREVE), "Schema a blocchi dell'edificio: numero del blocco, dimensioni in pianta, altezza di gronda, altezza da proteggere in copertura e posizione delle aste per tipo");
  const sdf = frasiStatoDiFatto(r);
  if (sdf.length) B.push(h3("Stato di fatto rilevato al sopralluogo"), el(...sdf));
  const fotoBlocchi = () => { for (const f of im.foto ?? []) { B.push(bloccoImmagine(f.img, 15, "centro", 11)); B.push(p([{ t: `Figura ${++nFig} – `, b: true }, { t: f.didascalia || "Immagine del sopralluogo" }], { allinea: "centro", dimensione: 9 })); } };
  if (r.descrizione) B.push(...r.descrizione.split(/\n{2,}/).map((t) => p(t.trim())));
  else if (!sdf.length) B.push(p([dc("stato di fatto: compilare la sezione \"Sopralluogo\" in Dati della relazione (componenti naturali, calate, terra, SPD, impianti in copertura)")]));
  if (im.foto?.length) fotoBlocchi(); else B.push(p([dc("fotografie del sopralluogo e planimetria (si possono aggiungere in \"Dati della relazione\")")]));

  // dati iniziali e rischio: perdite considerate dai dati delle zone
  const zz = x.rischio?.zone ?? [];
  const perdite: { l: string; testo: string }[] = [];
  if (!zz.length || zz.some((z) => z.oreAnno > 0)) perdite.push({ l: "L1", testo: "perdita di vite umane (L1), per la presenza di persone nella struttura;" });
  if (x.rischio?.struttura.danniMateriali !== false) perdite.push({ l: "L2", testo: "perdita dovuta a danni materiali alla struttura e al suo contenuto (L2);" });
  if (!zz.length || zz.some((z) => (z.oreApparecchi ?? 8760) > 0)) perdite.push({ l: "L3", testo: `perdita dovuta al guasto degli impianti interni (L3), valutata con la frequenza del danno F${zz.some((z) => z.impiantiCritici) ? " (impianti critici: FT = 0,1)" : ""}.` });
  B.push(h1("12. Dati iniziali e valutazione del rischio"),
    p([{ t: "La destinazione d'uso prevalente della struttura è: " }, ...destinazione, { t: "." }]),
    ...(dest ? [p(dest.testo), p(dest.obbligo)] : []),
    p("In relazione anche alla sua destinazione d'uso, la struttura può essere soggetta a:"),
    el(...perdite.map((x2) => x2.testo)),
    p(`In accordo con la norma CEI EN IEC 62305-2:2026-10, per valutare la necessità della protezione contro il fulmine ${perdite.some((x2) => x2.l === "L3") ? "devono pertanto essere calcolati il rischio R e la frequenza del danno F" : "deve pertanto essere calcolato il rischio R"} per ogni zona della struttura${x.rischio ? ` (${x.rischio.zone.length} ${x.rischio.zone.length === 1 ? "zona" : "zone"}: ${x.rischio.zone.map((z) => z.nome).join(", ")})` : ""}.`),
    p(r.valutazioneEconomica ? "La valutazione della convenienza economica delle misure di protezione, richiesta dal Committente, è riportata in un documento separato." : "Le valutazioni di natura economica, volte ad accertare la convenienza dell'adozione delle misure di protezione, non sono state condotte perché non richieste dal Committente."),
  );
  let esitoSenza: EsitoStruttura | null = null, esitoCon: EsitoStruttura | null = null, minimo: ClasseLps | null = null;
  if (x.rischio && x.rischio.zone.length) {
    try {
      esitoSenza = calcolaZone(x.rischio.struttura, x.rischio.zone, { lps: "nessuno", spd: "nessuno" });
      esitoCon = calcolaZone(x.rischio.struttura, x.rischio.zone, { lps: lpl, spd: lpl });
      const m = protezioneMinimaZone(x.rischio.struttura, x.rischio.zone); minimo = m ? m.protezione.lps : null;
    } catch { esitoSenza = esitoCon = null; }
  }
  if (esitoSenza && esitoCon && x.rischio) {
    const st = x.rischio.struttura, zone = x.rischio.zone, e = esitoSenza;
    B.push(h2("12.1 Dati di ingresso e numero di eventi pericolosi"),
      tab(["Grandezza", "Valore"], [
        ["Dimensioni della struttura L × W × H", `${it(st.L)} × ${it(st.W)} × ${it(st.H)} m`],
        ["Fattore di posizione CD", it(st.CD)],
        ["Tensione di tenuta all'impulso degli impianti Uw", `${it(st.Uw ?? 2.5)} kV`],
        ["Densità NG / NSG", `${it(st.NG)} / ${it(e.NSG)} 1/(anno·km²)`],
        [[...pedice("A", "D"), { t: " – area di raccolta per fulmini sulla struttura" }], [...sci(e.AD), { t: " m²" }]],
        [[...pedice("A", "M"), { t: " – area di raccolta per fulmini in prossimità della struttura" }], [...sci(e.AM), { t: " m²" }]],
        [[...pedice("N", "D"), { t: " – fulmini sulla struttura" }], [...sci(e.ND), { t: " /anno" }]],
        [[...pedice("N", "M"), { t: " – fulmini in prossimità della struttura" }], [...sci(e.NM), { t: " /anno" }]],
        [[...pedice("N", "L"), { t: " – fulmini sulle linee (somma)" }], [...sci(e.NL), { t: " /anno" }]],
        [[...pedice("N", "I"), { t: " – fulmini in prossimità delle linee (somma)" }], [...sci(e.NI), { t: " /anno" }]],
        ...(e.NDJ > 0 ? [[[...pedice("N", "DJ"), { t: " – fulmini sulle strutture adiacenti" }], [...sci(e.NDJ), { t: " /anno" }]] as Testo[]] : []),
      ], [7, 4]));
    if (st.linee.length) B.push(h3("Linee entranti"), tab(["Linea", "Lunghezza (m)", "Posa CI", "Ambiente CE", "Tipo CT", "Ingresso / schermatura"], st.linee.map((l: Linea) => [l.nome, it(l.sezioni?.length ? l.sezioni.reduce((a, s) => a + s.lunghezza, 0) : l.lunghezza, 0), it(l.posa), it(l.ambiente), it(l.tipo), CONNESSIONI.find((c) => c.id === l.connessione)?.nome ?? (l.schermata ? "Schermata" : "Non schermata")]), [2, 1.4, 1, 1.2, 1, 4]));
    B.push(h3("Zone della struttura"), tab(["Zona", "Presenza (h/anno)", "Pavimento rt", "Rischio incendio rf", "Protezione incendio rp", "Categoria di perdita", "Misure contatto"], zone.map((z) => [z.nome, it(z.oreAnno, 0), PAVIMENTO.find((o) => o.valore === z.rt)?.nome ?? it(z.rt, 5), RISCHIO_INCENDIO.find((o) => o.id === z.rfId)?.nome ?? z.rfId, PROTEZIONE_INCENDIO.find((o) => o.valore === z.rp)?.nome ?? it(z.rp), (CATEGORIE.find((c) => c.id === z.categoria)?.nome ?? z.categoria).replace(/ \(.*\)$/, ""), MISURE_CONTATTO.find((o) => o.valore === z.misureContatto)?.nome ?? it(z.misureContatto, 3)]), [2, 1.3, 1.6, 2, 2, 1.6, 2]));
    const usati = <T,>(lista: T[], usa: (o: T) => boolean) => lista.map((o, i) => (usa(o) ? i : -1)).filter((i) => i >= 0);
    B.push(h3("Coefficienti adottati (righe evidenziate)"));
    tabN("Categorie di perdita e perdite tipiche LF, LO (CEI EN IEC 62305-2:2026-10, Tab. C.2)", ["Categoria della struttura", "LF", "LO"], CATEGORIE.map((c) => [c.nome, sci(c.LF), sci(c.LO)]), [8, 1.6, 1.6]);
    { const b = B.pop()!; B.push(evid(b, usati(CATEGORIE, (c) => zone.some((z) => z.categoria === c.id || z.categoriaL2 === c.id)))); }
    tabN("Fattore di riduzione per rischio d'incendio o di esplosione rf (Tab. B.6)", ["Rischio", "rf"], RISCHIO_INCENDIO.map((o) => [o.nome, sci(o.valore)]), [8, 2]);
    { const b = B.pop()!; B.push(evid(b, usati(RISCHIO_INCENDIO, (o) => zone.some((z) => z.rfId === o.id)))); }
    tabN("Fattore di riduzione per le misure antincendio rp (Tab. B.5)", ["Misure", "rp"], PROTEZIONE_INCENDIO.map((o) => [o.nome, it(o.valore)]), [8, 2]);
    { const b = B.pop()!; B.push(evid(b, usati(PROTEZIONE_INCENDIO, (o) => zone.some((z) => z.rp === o.valore)))); }
    tabN("Fattore di riduzione in funzione del tipo di superficie rt (Tab. B.2)", ["Superficie del suolo o del pavimento", "rt"], PAVIMENTO.map((o) => [o.nome, sci(o.valore)]), [8, 2]);
    { const b = B.pop()!; B.push(evid(b, usati(PAVIMENTO, (o) => zone.some((z) => z.rt === o.valore)))); }
    tabN("Probabilità per le misure contro le tensioni di contatto e di passo (Tab. B.1)", ["Misura di protezione", "Valore"], MISURE_CONTATTO.map((o) => [o.nome, sci(o.valore)]), [8, 2]);
    { const b = B.pop()!; B.push(evid(b, usati(MISURE_CONTATTO, (o) => zone.some((z) => z.misureContatto === o.valore)))); }
    const CL: ClasseLps[] = ["nessuno", "IV", "III", "II", "I"];
    tabN("Probabilità PLPS, PEB e PSPD in funzione della classe di LPS e del livello degli SPD (Tab. B.3, B.13, B.7 e B.8)", ["Classe / livello", ...CL.map((c) => (c === "nessuno" ? "Nessuno" : c))], [
      ["PLPS (struttura protetta da LPS)", ...CL.map((c) => it(PLPS[c], 3))], ["PEB (SPD per il collegamento equipotenziale)", ...CL.map((c) => it(PEB[c], 3))], ["PSPD (sistema coordinato di SPD)", ...CL.map((c) => it(PSPD[c], 3))],
    ], [5, 1.4, 1.2, 1.2, 1.2, 1.2], CL.indexOf(lpl) + 1);
    const righeEsito = (es: EsitoStruttura): Testo[][] => es.zone.map((z) => [z.zona.nome, sci(z.RL1), sci(z.RL2), [...sci(z.R), { t: x.rischio?.struttura.metodo === "italia" ? (z.conforme ? "  RL1 ≤ RT1, RL2 ≤ RT2" : "  oltre RT1/RT2") : z.conforme ? "  ≤ RT" : "  > RT", b: true }], sci(z.F), [...sci(z.FT), { t: z.frequenzaConforme ? "  F ≤ FT" : "  F > FT", b: true }]]);
    const comp = (es: EsitoStruttura) => tab(["Zona", "RAT", "RAD", "RB", "RC", "RM", "RU", "RV", "RW", "RZ"], es.zone.map((z) => [z.zona.nome, sci(z.componenti.RA), sci(z.componenti.RAD), sci(z.componenti.RB), sci(z.componenti.RC), sci(z.componenti.RM), sci(z.componenti.RU), sci(z.componenti.RV), sci(z.componenti.RW), sci(z.componenti.RZ)]), [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    B.push(h2("12.2 Rischio della struttura senza misure di protezione"), tab(["Zona", "RL1", "RL2", "R", "F", "FT"], righeEsito(esitoSenza), [2.4, 1.6, 1.6, 2.2, 1.6, 2.2]), h3("Componenti di rischio"), comp(esitoSenza),
      h2(`12.3 Rischio della struttura con le misure di progetto (LPS e SPD di livello ${lpl})`), tab(["Zona", "RL1", "RL2", "R", "F", "FT"], righeEsito(esitoCon), [2.4, 1.6, 1.6, 2.2, 1.6, 2.2]), h3("Componenti di rischio"), comp(esitoCon));
    B.push(h3("Confronto grafico"));
    fig(barreLog({ categorie: esitoSenza.zone.map((z) => z.zona.nome), serie: [{ nome: "senza protezione", valori: esitoSenza.zone.map((z) => z.R) }, { nome: `con LPS e SPD di livello ${lpl}`, valori: esitoCon.zone.map((z) => z.R) }], soglia: { valore: RT, etichetta: "RT = 10⁻⁵" }, asseY: "rischio R (1/anno)" }), "Rischio R di ogni zona senza e con le misure di protezione, confrontato con RT (scala logaritmica)");
    const peggiore = esitoSenza.zone.reduce((a, z, i) => (z.R > (esitoSenza!.zone[a]?.R ?? 0) ? i : a), 0);
    const zs = esitoSenza.zone[peggiore]!, zc = esitoCon.zone[peggiore]!;
    const NOMI_C = ["RAT", "RAD", "RB", "RC", "RM", "RU", "RV", "RW", "RZ"] as const;
    const val = (z: typeof zs) => NOMI_C.map((k) => (k === "RAT" ? z.componenti.RA : z.componenti[k]));
    fig(barreLog({ categorie: [...NOMI_C], serie: [{ nome: "senza protezione", valori: val(zs) }, { nome: `con LPS e SPD di livello ${lpl}`, valori: val(zc) }], soglia: { valore: RT, etichetta: "RT = 10⁻⁵" }, asseY: "componente di rischio (1/anno)" }), `Componenti di rischio della zona «${zs.zona.nome}» senza e con le misure di protezione (scala logaritmica)`);
    fig(barreLog({ categorie: esitoSenza.zone.map((z) => z.zona.nome), serie: [{ nome: "F senza protezione", valori: esitoSenza.zone.map((z) => z.F) }, { nome: `F con SPD di livello ${lpl}`, valori: esitoCon.zone.map((z) => z.F) }], soglia: { valore: Math.min(...esitoCon.zone.map((z) => z.FT)), etichetta: `FT = ${it(Math.min(...esitoCon.zone.map((z) => z.FT)), 2)}` }, asseY: "frequenza del danno F (1/anno)" }), "Frequenza del danno agli impianti interni F di ogni zona, confrontata con FT (scala logaritmica)");
    const caso = esitoSenza.conforme && esitoSenza.frequenzaConforme ? 1 : esitoCon.conforme && esitoCon.frequenzaConforme ? 2 : 3;
    B.push(h2("12.4 Esito"),
      p([{ t: caso === 1 ? "Caso 1 – la struttura è autoprotetta: non sono necessarie misure di protezione." : caso === 2 ? `Caso 2 – con un LPS di classe ${lpl} e un sistema di SPD di livello ${lpl} la struttura è protetta.` : `Caso 3 – con le misure di livello ${lpl} la struttura NON risulta protetta: servono ulteriori misure.`, b: true }]),
      p(minimo ? `La protezione minima che rende R ≤ RT in tutte le zone è: ${nomeProtezione(minimo)}.${minimo !== "nessuno" && LIVELLI.indexOf(minimo as Lpl) < LIVELLI.indexOf(lpl) ? " Il livello di progetto è inferiore a quello minimo e va rivisto." : ""}` : "Nessuna combinazione di LPS e SPD dello stesso livello porta R ≤ RT: servono altre misure (antincendio, schermature, misure contro le tensioni di contatto e di passo)."),
      ...(!esitoCon.frequenzaConforme ? [p("La frequenza del danno F supera FT: vanno previste misure SPM (sistema coordinato di SPD, schermature, percorsi dei cavi) secondo la CEI EN IEC 62305-4:2026-10.")] : []),
    );
  } else {
    B.push(p([{ t: x.risultati.rischio ? `Livello di protezione da valutazione: ${x.risultati.rischio.lpl} (${x.risultati.rischio.esito}). ` : "" }, dc(`valutazione del rischio non compilata nell'app (pagina Rischio). Livello di progetto dichiarato: LPL ${lpl}`)]));
  }

  // ---------- 13 soluzione di progetto
  const capt = x.conduttori.filter((c) => c.tipo === "captazione"), lCapt = capt.reduce((a, c) => a + lunghezza(c), 0);
  const calate = x.conduttori.filter((c) => c.tipo === "calata");
  // calate del progetto (disegnate o calcolate) oppure, se maggiori, quelle esistenti rilevate al sopralluogo
  const nCalate = Math.max(calate.length || x.risultati.calate?.numero || 0, r.calateNumero ?? 0);
  const per = corpi.reduce((t, c) => t + perimetro(c.impronta), 0) || (d.L > 0 && d.W > 0 ? 2 * (d.L + d.W) : 0);
  const asteGr = new Map<string, { altezza: number; codice: string; n: number; tipo: TipoAsta }>();
  for (const a of x.aste) { const tp = tipi.get(a.id) ?? "fissa", kk = `${tp}|${a.altezza.toFixed(2)}|${a.codiceOBO}`; const g = asteGr.get(kk); if (g) g.n++; else asteGr.set(kk, { altezza: a.altezza, codice: a.codiceOBO, n: 1, tipo: tp }); }
  // distanza massima tra un'asta e la più vicina (in pianta)
  let dMax = 0;
  for (const a of x.aste) { let m = Infinity; for (const b of x.aste) if (b !== a) m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y)); if (Number.isFinite(m)) dMax = Math.max(dMax, m); }
  const dDiag = Math.max(0, ...verifiche.map((v) => v.diagonale ?? 0));
  const ver = x.risultati.captazione?.verifica;
  B.push(h1("13. Scelta delle misure di protezione e soluzione di progetto"),
    p(`Da progetto, l'analisi di rischio definita per la struttura è di livello ${lpl}. Pertanto, viene previsto un LPS di classe ${lpl} coordinato con il sistema dei dispersori ${r.terraEsistente !== "nessuno" ? "esistente" : "di progetto"} e con il sistema di SPD ${r.spdEsistenti === "si" ? "esistente" : "di progetto"}.`),
    h2("13.1 Sistema di captazione"),
  );
  { const perTipo: Partial<Record<TipoAsta, number>> = {};
    for (const a of x.aste) { const t2 = tipi.get(a.id) ?? "fissa"; perTipo[t2] = (perTipo[t2] ?? 0) + 1; }
    const fr = fraseSoluzione(r, perTipo, x.conduttori.some((c) => c.tipo === "captazione"), lpl, R);
    if (x.risultati.captazione?.descrizione) B.push(p(x.risultati.captazione.descrizione));
    if (fr) B.push(p(fr));
    if (r.fissaggioAste === "putrella" || r.fissaggioAste === "misto") { const sp = spessorePutrella(r.putrellaProfilo, r.putrellaSpessore); if (r.putrellaProfilo || sp != null) B.push(p(`Le aste fissate alla struttura metallica si montano sulle putrelle${r.putrellaProfilo ? ` ${r.putrellaProfilo}` : ""}${sp != null ? ` (spessore dell'ala ${it(sp, 1)} mm)` : ""} con morsetti per putrella adatti a questo spessore, collegati equipotenzialmente alla struttura.`)); else if (r.fissaggioAste === "putrella") B.push(p([{ t: "Aste fissate a putrella: " }, dc("profilo (es. IPE 200) o spessore dell'ala delle putrelle in mm")])); }
    if (!fr && !x.risultati.captazione?.descrizione) B.push(p([dc("captazione non ancora disegnata nell'app (Edificio 3D)")])); }
  if (asteGr.size || capt.length) {
    B.push(p("Così progettato l'impianto di captazione sarà costituito da:"), el(
      ...[...asteGr.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.altezza - b.altezza).map((g): Testo => `N° ${g.n} – ${NOME_TIPO[g.tipo].replace(/^aste /, g.n === 1 ? "asta " : "aste ").replace("isolate", g.n === 1 ? "isolata" : "isolate").replace("non isolate", g.n === 1 ? "non isolata" : "non isolate")} di altezza ${it(g.altezza)} m${g.codice ? ` (art. ${g.codice})` : ""}`),
      ...(() => { const ni = x.aste.filter((a) => tipi.get(a.id) !== "isolata").length, is = x.aste.length - ni; return [...(ni ? [`N° ${ni} collegamenti di aste non isolate` as Testo] : []), ...(is ? [`N° ${is} collegamenti per aste isolate (conduttore isCon)` as Testo] : [])]; })(),
      ...(capt.length ? [`conduttori di captazione per ${it(lCapt, 1)} m complessivi (${capt.length} ${capt.length === 1 ? "tratto" : "tratti"})` as Testo] : []),
      ...(x.risultati.captazione ? [`N° ${x.risultati.captazione.giunzioni} giunzioni e N° ${x.risultati.captazione.incroci} incroci` as Testo] : []),
    ));
  }
  B.push(p(`Con un LPS di classe ${lpl} la sfera rotolante di riferimento ha raggio ${R} m. La profondità di penetrazione della sfera tra due captatori in funzione della loro distanza (diagonale della figura replicata) è:`),
    tab(["Distanza tra i captatori d (m)", ...[10, 15, 20, 25, 30, 35, 40].map(String)], [["Penetrazione p (m)", ...[10, 15, 20, 25, 30, 35, 40].map((dd) => it(penetrazione(R, dd), 2))]], [3.5, 1, 1, 1, 1, 1, 1, 1]),
  );
  fig(graficoSfera(R, dDiag > 0 ? dDiag : dMax > 0 ? dMax : null), `Profondità di penetrazione della sfera rotolante (R = ${R} m) in funzione della distanza tra i captatori e schema in sezione`);
  B.push(
  );
  const conAste = verifiche.filter((v) => v.aste.length);
  if (conAste.length) {
    B.push(h3("Verifica dell'altezza protetta per blocco"));
    for (const v of conAste) {
      const nome = `Blocco ${v.numero}${v.corpo.nome ? ` (${v.corpo.nome})` : ""}`;
      const frase: Run[] = [{ t: `${nome}: ${v.aste.length} ${v.aste.length === 1 ? "asta" : "aste"}` }];
      if (v.interasse != null) frase.push({ t: ` con interasse massimo di circa ${it(v.interasse, 1)} m${v.diagonale != null && v.diagonale !== v.interasse ? `, che formano una figura replicata con diagonale di ${it(v.diagonale, 1)} m` : ""}; la profondità di penetrazione della sfera rotolante al centro della figura è di ${it(v.penetrazione ?? 0, 2)} m` });
      if (v.puntaMin != null) frase.push({ t: `. La punta più bassa delle aste è a ${it(v.puntaMin, 2)} m sul piano di copertura, quindi la sfera resta a ${it(v.protezione ?? v.puntaMin, 2)} m dalla copertura` });
      if (v.richiesta != null) frase.push({ t: `; l'altezza da proteggere è di ${it(v.daProteggere ?? 0, 1)} m, che con la distanza di sicurezza di ${it(r.margineSicurezza, 1)} m richiede ${it(v.richiesta, 2)} m: ` }, { t: v.esito === "ok" ? "verifica soddisfatta." : "verifica NON soddisfatta, aumentare l'altezza delle aste o ridurne l'interasse.", b: true });
      else frase.push({ t: ". " }, dc(`altezza da proteggere sul blocco ${v.numero} (Dati della relazione)`));
      B.push(p(frase));
    }
    tabN("Verifica della penetrazione della sfera rotolante per blocco", ["Blocco", "H gronda (m)", "Aste", "Interasse (m)", "Diagonale (m)", "Penetrazione (m)", "Punta min. (m)", "Altezza protetta (m)", "Richiesta (m)", "Esito"], conAste.map((v) => [String(v.numero), it(v.corpo.quotaBase + v.corpo.altezzaGronda, 1), String(v.aste.length), v.interasse != null ? it(v.interasse, 1) : "—", v.diagonale != null ? it(v.diagonale, 1) : "—", v.penetrazione != null ? it(v.penetrazione, 2) : "—", v.puntaMin != null ? it(v.puntaMin, 2) : "—", v.protezione != null ? it(v.protezione, 2) : "—", v.richiesta != null ? it(v.richiesta, 2) : "—", v.esito === "ok" ? "OK" : v.esito === "no" ? [{ t: "NO", b: true, colore: "C62828" }] : "dati mancanti"]), [1, 1.1, 0.8, 1.1, 1.1, 1.2, 1.1, 1.2, 1.1, 1.2]);
    B.push(p("Punta min.: altezza della punta dell'asta più bassa sul piano di copertura del blocco; altezza protetta = punta min. − penetrazione; richiesta = altezza da proteggere + distanza di sicurezza.", { dimensione: 8.5 }));
  } else if (verifiche.some((v) => v.maglia)) B.push(p("La copertura è protetta con conduttori a maglia: la verifica è riportata nella tabella seguente (superfici protette dalla sfera rotolante e dalla maglia)."));
  if (ver) B.push(tab(["Verifica della captazione", "Valore"], [["Superficie protetta dalla sfera rotolante", `${it(ver.areaProtettaSfera, 1)} m²`], ["Superficie protetta dalla maglia", `${it(ver.areaProtettaMaglia, 1)} m²`], ["Superficie esposta", `${it(ver.areaEsposta, 1)} m²`], ["Maglie conformi", `${ver.maglie.filter((m) => m.conforme).length} su ${ver.maglie.length}`]], [6, 5]), ...(ver.areaEsposta > 0.5 ? [p([{ t: `Attenzione: ${it(ver.areaEsposta, 1)} m² di copertura risultano esposti. `, b: true }, dc("integrare la captazione o motivare")])] : []));
  const asteTreppiede = x.aste.filter((a) => { const t2 = tipi.get(a.id); return t2 === "treppiede" || t2 === "isolata"; });
  if (asteTreppiede.length) {
    B.push(p(x.vento ? "Aste su treppiede: il numero di blocchi in calcestruzzo di ogni asta è scelto con la verifica al vento riportata più avanti; le tabelle seguenti del catalogo OBO ne sono il riferimento. Va inoltre considerato il peso complessivo della struttura che sostiene l'asta (asta, treppiede, blocchi) rispetto alla portata della copertura." : "Aste su treppiede: in funzione della velocità del vento di progetto è necessario scegliere il numero di blocchi in calcestruzzo che sostengono ogni asta. Va inoltre considerato il peso complessivo della struttura che sostiene l'asta (asta, treppiede, blocchi) rispetto alla portata della copertura."));
    const bl = x.vento ? [] : blocchiPerVento(asteTreppiede, r.ventoKmh);
    if (x.vento) { /* blocchi dalla verifica al vento */ } else if (r.ventoKmh != null && bl.length) {
      tabN(`Blocchi in calcestruzzo per le aste su treppiede del progetto – velocità del vento di progetto ${it(r.ventoKmh, 0)} km/h (tabelle del catalogo OBO)`, ["Art. asta", "Altezza (m)", "N° aste", "Blocchi per asta", "Peso blocchi per asta", "Blocchi totali"], bl.map((b) => [[{ t: b.codice, b: true }], it(b.altezza, 1), String(b.numero), b.blocchi ?? [{ t: `oltre ${b.ventoMax} km/h: non ammesso`, b: true, colore: "C62828" }], b.pesoKg != null ? `${b.pesoKg} kg` : "—", b.blocchi ? `${Number(b.blocchi.split(" x ")[0]) * b.numero} × 16 kg` : "—"]), [1.6, 1.1, 1, 1.6, 1.8, 1.8]);
      const tot = bl.reduce((a, b) => a + (b.blocchi ? Number(b.blocchi.split(" x ")[0]) * b.numero : 0), 0);
      B.push(p(`In totale sono necessari ${tot} blocchi da 16 kg (${it(tot * 16, 0)} kg)${bl.some((b) => !b.blocchi) ? "; per le aste segnate la velocità di progetto supera i valori del catalogo: valutare un'asta più corta o un altro sistema di fissaggio" : ""}.`));
    } else if (r.ventoKmh == null) B.push(p([dc("velocità del vento di progetto (km/h) in Dati della relazione: l'app sceglie i blocchi dalle tabelle seguenti")]));
    for (const tb of blocchiTreppiede.tabelle) {
      const cols = tb.colonne as { altezza: number; materiale?: string; asta: string; sostegno: string; vento: number[] }[];
      if (!cols.some((c) => asteTreppiede.some((a) => a.codiceOBO === c.asta)) && bl.length) continue;
      const art = (c: string) => `${c.slice(0, 4)} ${c.slice(4)}`;
      tabN(`Numero di blocchi in calcestruzzo da 16 kg – ${tb.titolo} (catalogo OBO)`, ["Altezza asta (m)", ...cols.map((c) => it(c.altezza, 1) + (c.materiale ? ` ${c.materiale}` : "")), "Blocchi"], [
        ["Asta – Art. n.", ...cols.map((c) => art(c.asta)), ""],
        ["Treppiede – Art. n.", ...cols.map((c) => art(c.sostegno)), ""],
        ...blocchiTreppiede.blocchi.map((bk, i2) => [i2 === 0 ? "Velocità del vento (km/h)" : "", ...cols.map((c) => String(c.vento[i2] ?? "")), [{ t: bk, b: true }]] as Testo[]),
      ], [2.6, ...cols.map(() => 1), 1.6]);
      { const b = B.pop()!; B.push(b.tipo === "tabella" ? { ...b, dimensione: cols.length > 5 ? 7.5 : 8.5, evidenziaColonna: cols.findIndex((c) => asteTreppiede.some((a) => a.codiceOBO === c.asta)) + 1 || undefined } as Blocco : b); }
    }
  }
  if (x.vento && x.aste.length) {
    const vv = x.vento, ev = verificaVentoProgetto(x.aste, articoli, vv, (a) => tipi.get(a.id) ?? "fissa");
    const vb = velocitaBase(vv.zona, vv.altitudine), cat = CATEGORIE_VENTO.find((c) => c.cat === vv.categoria)!, zn = ZONE_VENTO.find((z) => z.zona === vv.zona)!;
    B.push(h3("Verifica al vento e zavorre delle aste"),
      p("L'azione del vento sulle aste è calcolata secondo le NTC 2018 (§3.3) e la UNI EN 1991-1-4 con l'Annesso Nazionale italiano, per un periodo di ritorno di 50 anni. La pressione di picco alla quota z è qp(z) = qb · ce(z), con qb = ½ · ρ · vb² (ρ = 1,25 kg/m³) e il coefficiente di esposizione ce(z) della categoria di esposizione del sito. Ogni asta è un cilindro: la forza è F = cf · qp(z) · d · dz integrata lungo l'asta, con cf = 1,2 · ψλ (EN 1991-1-4 §7.9, ψλ dalla snellezza). Le verifiche di equilibrio (EQU) amplificano il vento con γQ = 1,5 e riducono i pesi favorevoli con γG = 0,9: ribaltamento attorno alla retta tra due piedi del sostegno e scorrimento con coefficiente di attrito μ. Per le aste fissate alla struttura si verifica la tensione di flessione dell'asta al supporto superiore."),
    );
    tabN("Parametri del vento del sito", ["Parametro", "Valore"], [
      ["Zona (NTC 2018 Tab. 3.3.I)", `${vv.zona} – ${zn.descrizione}${vv.regione ? ` (${vv.regione}${vv.provincia ? `, ${vv.provincia}` : ""})` : ""}`],
      ["vb,0 · a0 · ks", `${it(zn.vb0, 0)} m/s · ${it(zn.a0, 0)} m · ${it(zn.ks, 2)}`],
      ["Altitudine del sito as", `${it(vv.altitudine, 0)} m s.l.m. (ca = ${it(vb.ca, 3)})`],
      ["Velocità di riferimento vb", `${it(vb.vb, 2)} m/s`],
      ["Pressione cinetica di riferimento qb", `${it(pressioneBase(vb.vb), 0)} N/m²`],
      ["Categoria di esposizione", `${cat.cat} (kr = ${it(cat.kr, 2)}, z0 = ${it(cat.z0, 2)} m, zmin = ${it(cat.zmin, 0)} m)`],
      ["ce a 10 m", it(ceVento(10, vv.categoria), 3)],
      ["Attrito blocchi–copertura μ", it(vv.mu, 2)],
      ["Coefficienti parziali", "γQ = 1,5 (vento) · γG = 0,9 (pesi favorevoli)"],
      ["Aste a parete: interasse supporti · materiale", `${it(vv.interasseParete, 2)} m · ${vv.materialeParete === "AL" ? "alluminio" : vv.materialeParete === "VA" ? "acciaio inox V2A" : "acciaio zincato a caldo"}`],
    ], [6, 7]);
    const sost = ev.gruppi.filter((g) => g.metodo !== "parete"), par = ev.gruppi.filter((g) => g.metodo === "parete");
    const rosso = (t: string): Testo => [{ t, b: true, colore: "C62828" }];
    if (sost.length) {
      tabN("Aste su sostegno: azione del vento e blocchi FangFix da 16 kg (art. 5403227)", ["Art. asta", "Sostegno / metodo", "N°", "H (m)", "Quota base (m)", "Vento in punta (km/h)", "F (kN)", "M base (kN·m)", "Blocchi per asta", "Barra per base", "MEd / MRd (kN·m)", "Esito"],
        sost.map((g) => [[{ t: g.codice || "—", b: true }], NOME_METODO[g.metodo], String(g.numero), it(g.altezza, 2), it(g.quotaBase, 1), it(g.vento, 0), it(g.F, 3), it(g.M, 3),
          g.blocchi != null ? `${g.blocchi}${g.basi && g.basi > 1 ? ` (${g.basi} × ${g.perBase})` : ""} = ${it(g.blocchi * 16, 0)} kg` : rosso("oltre il massimo"),
          g.basiTreppiede && g.basiTreppiede.length > 1 ? descriviBasi(g.basiTreppiede) : g.barra ? `${g.barra.tipo} (${g.barra.codice})` : "—",
          g.ribaltamento ? `${it(g.ribaltamento.sollecitante, 2)} / ${it(g.ribaltamento.resistente, 2)}` : "tabella OBO",
          g.esito === "ok" ? (g.stima ? "OK (stima)" : "OK") : rosso("NON VERIFICATA")]), [1.2, 2.2, 0.5, 0.7, 0.8, 0.9, 0.7, 0.8, 1.4, 1.5, 1.3, 1]);
    }
    if (par.length) {
      tabN("Aste fissate alla struttura con due supporti: verifica a flessione", ["Art. asta", "N°", "Ø (mm)", "L (m)", "Quota base (m)", "Vento in punta (km/h)", "Interasse supporti (m)", "R sup. / inf. (kN)", "σ / fd (MPa)", "Sfruttamento", "Esito"],
        par.map((g) => [[{ t: g.codice || "—", b: true }], String(g.numero), it(g.diametro, 1), it(g.altezza, 2), it(g.quotaBase, 1), it(g.vento, 0), it(g.parete!.s, 2), `${it(g.parete!.R1, 3)} / ${it(Math.abs(g.parete!.R2), 3)}`, `${it(g.parete!.sigma, 0)} / ${it(g.parete!.fd, 0)}`, `${it(g.parete!.sfruttamento * 100, 0)} %`, g.esito === "ok" ? "OK" : rosso("NON VERIFICATA")]), [1.3, 0.6, 0.8, 0.8, 0.9, 1, 1, 1.4, 1.2, 1, 1.1]);
    }
    const ko = ev.gruppi.filter((g) => g.esito !== "ok");
    B.push(p([{ t: ko.length ? `${ko.reduce((a, g) => a + g.numero, 0)} aste non risultano verificate (righe in rosso): ` : "Tutte le aste del progetto risultano verificate al vento. ", b: true }, ...(ko.length ? [dc("cambiare sostegno, altezza o fissaggio delle aste segnate e ripetere la verifica")] : [])]));
    if (ev.computo.length) {
      tabN("Zavorre e accessori risultanti dalla verifica al vento", ["Art.", "Descrizione", "Quantità"], ev.computo.map((c) => [[{ t: c.codice, b: true }], c.descrizione, `${c.quantita} pz`]), [1.4, 8, 1.6]);
      B.push(p(`In totale ${ev.blocchiTotali} blocchi da 16 kg (${it(ev.blocchiTotali * 16, 0)} kg di zavorra): il carico dei sostegni e dei blocchi va confrontato con la portata della copertura. Ogni base di blocchi ha una barra filettata M16 isFang 3B della lunghezza adatta al numero di blocchi (G1 270 mm per 1 blocco, G2 340 mm per 2, G3 430 mm per 3, G4 500 mm per 4: massimo installabile 4 blocchi per base; nei treppiedi isFang da 1500 mm oltre 12 blocchi si aggiungono 3 basi interne) e una protezione per ogni blocco (istruzioni OBO); sotto i blocchi va posato un appoggio protettivo concordato con il copritetto.`));
    }
    const note = [...new Set(ev.gruppi.flatMap((g) => g.note.map((n) => `${g.codice || "asta senza articolo"}: ${n}`)))];
    if (note.length) B.push(p("Note alla verifica:", { dimensione: 9 }), el(...note.slice(0, 20)));
    B.push(p("La verifica è un predimensionamento: le istruzioni OBO richiedono che il numero definitivo dei blocchi e il fissaggio siano confermati dallo strutturista per il progetto specifico, anche in relazione alla portata della copertura.", { dimensione: 9 }));
  }
  fig(piantaCopertura(corpi, x.conduttori, x.aste), "Pianta schematica della copertura con captatori, conduttori e calate (dal modello di progetto; il disegno esecutivo è nelle tavole allegate)");
  B.push(
    p("I captatori saranno collegati al sistema disperdente attraverso un insieme di calate posizionate lungo il perimetro dell'edificio. Le aste sono posizionate nelle vicinanze delle calate per ridurre al minimo le correnti vaganti sul tetto dell'edificio ed evitare quindi accoppiamenti elettrici indesiderati. Nelle planimetrie allegate è possibile individuare la posizione esatta di tutto il sistema dei captatori; i tipologici del capitolo 14 dettagliano i collegamenti."));
  B.push(h2("13.2 Calate"));
  { const fc = fraseCalate(r, nCalate); if (fc) B.push(p(fc)); }
  if (nCalate) {
    B.push(tab(["Elemento", "Valore"], [
      ["Numero di calate", `${nCalate}${r.calateNumero != null && r.calateNumero >= (calate.length || x.risultati.calate?.numero || 0) ? " (esistenti, da sopralluogo)" : ""}`], ["Perimetro della struttura", `${it(per, 1)} m`],
      ...(r.calateInterasse != null ? [["Interasse rilevato", `${it(r.calateInterasse, 1)} m`] as Testo[]] : []),
      ["Distanza media tra le calate", per > 0 ? `${it(per / nCalate, 1)} m` : "—"], [`Distanza tipica (LPL ${lpl}, Tab. 5)`, `${dist} m`],
      ...(calate.length ? [["Lunghezza totale delle calate", `${it(calate.reduce((a, c) => a + lunghezza(c), 0), 1)} m`] as Testo[]] : x.risultati.calate ? [["Lunghezza conduttori di calata", `${it(x.risultati.calate.lunghezzaConduttori, 1)} m`] as Testo[]] : []),
    ], [5, 7]));
    if (per > 0 && (r.calateInterasse ?? per / nCalate) > dist * 1.25) B.push(p([{ t: "La distanza media supera di oltre il 25 % il valore preferenziale: ", b: true }, dc("aumentare le calate o motivare (componenti naturali, calate esistenti nella struttura)")]));
  } else if (r.calateNumero != null) {
    B.push(tab(["Elemento", "Valore"], [["Calate esistenti", String(r.calateNumero)], ["Interasse rilevato", r.calateInterasse != null ? `${it(r.calateInterasse, 1)} m` : per > 0 ? `${it(per / r.calateNumero, 1)} m (medio sul perimetro)` : "—"], [`Distanza preferenziale (LPL ${lpl}, Tab. 5)`, `${dist} m`]], [5, 7]));
    const intx = r.calateInterasse ?? (per > 0 ? per / r.calateNumero : 0);
    if (intx > dist * 1.25) B.push(p([{ t: `L'interasse delle calate esistenti supera di oltre il 25 % il valore preferenziale: `, b: true }, dc("integrare con nuove calate o motivare")]));
  } else B.push(p([dc("numero e posizione delle calate (esistenti o di progetto)")]));
  // separazione
  const ki = x.separazione.ki ?? KI[lpl], kc = kcSemplificato(Math.max(1, nCalate || 1));
  const km = { ...KM, ...(x.separazione.kmSolido ? { solido: x.separazione.kmSolido } : {}) };
  const esiti = verificaPunti(x.separazione.punti, ki, kc, km);
  B.push(h2("13.3 Distanza di separazione"),
    p("Tra l'LPS e le parti metalliche o gli impianti interni deve essere rispettata la distanza di separazione s, calcolata con il metodo semplificato della CEI EN IEC 62305-3:2026-10:"),
    p([{ t: "s = (k" }, { t: "i", sub: true }, { t: " × k" }, { t: "c", sub: true }, { t: " / k" }, { t: "m", sub: true }, { t: ") × l" }], { formula: true }),
    p(`con ki = ${it(ki, 3)} (LPL ${lpl}), kc = ${it(kc, 3)} (${nCalate || 1} calate), km = 1 in aria e ${it(km.solido, 2)} in materiale solido; l è la lunghezza lungo l'LPS dal punto considerato al più vicino collegamento equipotenziale.`),
  );
  tabN("Coefficiente ki in funzione della classe di LPS (CEI EN IEC 62305-3:2026-10, Tab. 11)", ["Classe di LPS", "I", "II", "III", "IV"], [["ki", ...LIVELLI.map((l) => it(KI[l], 2))]], [5, 1.5, 1.5, 1.5, 1.5], col);
  tabN("Coefficiente km in funzione del materiale isolante (CEI EN IEC 62305-3:2026-10, Tab. 12)", ["Materiale", "km"], (Object.keys(KM) as (keyof typeof KM)[]).map((m) => [NOMI_MATERIALE[m], it(km[m], 2)]), [9, 2]);
  if (esiti.length || nCalate) fig(graficoSeparazione(ki, kc, km.solido, esiti.map((e) => ({ l: e.l, d: e.d, conforme: e.conforme, nome: e.descrizione || e.id }))), "Distanza di separazione richiesta in funzione di l e distanze effettive dei punti verificati");
  if (esiti.length) B.push(tab(["Punto", "Materiale", "l (m)", "s richiesta (m)", "d effettiva (m)", "Esito"], esiti.map((e) => [e.descrizione || e.id, NOMI_MATERIALE[e.materiale].replace(/ \(.*\)$/, ""), it(e.l, 2), it(e.s, 3), it(e.d, 3), e.conforme ? "Conforme" : [{ t: "Non conforme: collegare o isolare", b: true }]]), [3, 2.5, 1, 1.5, 1.5, 1.8]));
  else B.push(p([dc("punti critici (impianti in copertura, parti metalliche) con la distanza effettiva")]));
  // terra
  B.push(h2("13.4 Impianto di terra"));
  const pic = x.picchetti, t = x.terra;
  if (t || pic.length || x.risultati.terra) {
    const area = corpi.reduce((a, c) => a + areaPoligono(c.impronta), 0) || d.L * d.W;
    const re = t && t.tipo !== "A" ? Math.sqrt((area + (t.tipo === "B" ? per * t.distanzaAnello : 0)) / Math.PI) : null;
    const righeT: Testo[][] = [["Tipo di dispersore", t ? (t.tipo === "A" ? "Tipo A – dispersori verticali o radiali" : t.tipo === "B" ? "Tipo B – anello esterno" : "Dispersore di fondazione") : x.risultati.terra?.descrizione ?? "—"]];
    if (pic.length) { const lo = Math.min(...pic.map((q) => q.lunghezza)), hi = Math.max(...pic.map((q) => q.lunghezza)); righeT.push(["Picchetti", `${pic.length} × ${it(lo)}${hi > lo ? `–${it(hi)}` : ""} m`]); }
    else if (x.risultati.terra?.numeroPicchetti) righeT.push(["Picchetti", `${x.risultati.terra.numeroPicchetti} × ${it(x.risultati.terra.lunghezzaPicchetto)} m`]);
    if (t?.tipo === "B") righeT.push(["Anello", `a ${it(t.distanzaAnello)} m dall'edificio, profondità ${it(t.profondita)} m`]);
    if (t?.l1 != null) righeT.push([[{ t: "Lunghezza minima l" }, { t: "1", sub: true }, { t: " (resistività del terreno)" }], `${it(t.l1)} m`]);
    if (re != null) righeT.push([[{ t: "Raggio equivalente r" }, { t: "e", sub: true }], `${it(re, 1)} m`]);
    B.push(p("Il sistema di dispersori disperde nel terreno la corrente di fulmine senza sovratensioni pericolose. È unico per l'LPS e per l'impianto elettrico ed è collegato al collettore principale di terra; i dispersori di edifici vicini sono preferibilmente collegati tra loro in un unico sistema disperdente."), tab(["Elemento", "Valore"], righeT, [5, 7]));
  } else if (r.terraEsistente !== "nessuno") {
    B.push(p(`L'impianto di protezione è collegato all'impianto di terra esistente${r.terraEsistente === "anello" ? ", costituito da un anello (dispersore di tipo B)" : r.terraEsistente === "fondazione" ? ", costituito dal dispersore di fondazione" : r.terraEsistente === "picchetti" ? ", costituito da dispersori a picchetto (tipo A)" : ", costituito da anelli e picchetti"}${r.terraCollegataAltri ? " e collegato ai dispersori degli edifici vicini in modo da formare un unico sistema disperdente" : ""}. Prima del collegamento vanno verificate la continuità e la resistenza di terra.`));
  } else B.push(p([dc("impianto di terra esistente o di progetto (tipo, anelli, collegamenti, misure di resistenza)")]));
  { const rhos = [100, 500, 1000, 1500, 2000, 2500, 3000];
    tabN("Lunghezza minima l1 del dispersore in funzione della resistività del terreno (CEI EN IEC 62305-3:2026-10, 5.4.2)", ["Resistività ρ (Ωm)", ...rhos.map(String)], LIVELLI.map((l) => [`Classe ${l} (m)`, ...rhos.map((rho) => it(l1Norma(l, rho), 1))]), [3, 1, 1, 1, 1, 1, 1, 1]);
    const b = B.pop()!; B.push(evid(b, [LIVELLI.indexOf(lpl)])); }
  tabN("Dimensioni minime dei dispersori (CEI EN IEC 62305-3:2026-10, Tab. 8)", ["Materiale", "Configurazione", "Diametro (mm)", "Sezione (mm²)", "Piastra (mm)"], DIMENSIONI_DISPERSORI.map((z) => [NOMI_MATERIALI[z.materiale], NOMI_CONFIGURAZIONI[z.configurazione], z.diametro != null ? String(z.diametro) : "—", z.sezione != null ? String(z.sezione) : "—", z.piastra ?? "—"]), [3, 3, 1.4, 1.4, 3]);
  // SPD
  B.push(h2("13.5 Protezione degli impianti interni (SPD)"),
    p("Le linee metalliche entranti (energia, telecomunicazioni, dati) sono collegate all'impianto equipotenziale all'ingresso nella struttura, direttamente o tramite SPD, per evitare scariche pericolose e proteggere gli impianti interni secondo la CEI EN IEC 62305-4:2026-10."));
  if (x.risultati.spd?.dispositivi.length) B.push(p(x.risultati.spd.descrizione), tab(["Art. No", "Descrizione", "Quantità"], x.risultati.spd.dispositivi.map((s) => [s.codice, s.descrizione, String(s.quantita)]), [2, 8, 1.5]));
  else B.push(p(r.spdEsistenti === "si" ? `Sulle linee entranti sono presenti SPD: ne va verificato il coordinamento con l'LPS di classe ${lpl} (SPD di tipo 1 per la corrente di fulmine all'ingresso delle linee).` : r.spdEsistenti === "da-verificare" ? `La presenza e l'idoneità degli SPD sulle linee entranti sono da verificare; con l'LPS di classe ${lpl} all'ingresso delle linee metalliche servono SPD di tipo 1 dimensionati per la corrente di fulmine.` : `All'ingresso delle linee metalliche si prevede l'installazione di SPD di tipo 1 dimensionati per la corrente di fulmine dell'LPL ${lpl}, coordinati con gli SPD a valle secondo la CEI EN IEC 62305-4:2026-10.`));

  // ---------- 14 tipologici
  const gruppi = new Map<string, { p: ParticolareLib; righe: RigaComputo[] }>();
  for (const riga of x.righe) { const pa = particolareDiRiga(riga, x.particolari); if (!pa) continue; const g = gruppi.get(pa.id); if (g) g.righe.push(riga); else gruppi.set(pa.id, { p: pa, righe: [riga] }); }
  B.push(h1("14. Particolari costruttivi (tipologici)"));
  if (gruppi.size) {
    B.push(p("In dettaglio, i componenti necessari secondo i tipologici qui descritti saranno (Qty TOT = quantità totale del progetto; Qty tipico = quantità per singola applicazione del particolare):"));
    let n = 0;
    for (const { p: pa, righe } of gruppi.values()) {
      n++;
      const tipica = (codice: string) => { const c = pa.componenti.find((kk) => kk.codiceOBO === codice); return c && c.quantita != null ? `${it(c.quantita)}${UNITA_TIPICA[c.unitaQuantita ?? ""] ?? ""}` : ""; };
      const unite = new Map<string, { codice: string; descrizione: string; q: number; unita: string }>();
      for (const rr of righe) { const kk = `${rr.codice}|${rr.unita}`; const u = unite.get(kk); if (u) u.q += rr.quantita; else unite.set(kk, { codice: rr.codice, descrizione: rr.descrizione, q: rr.quantita, unita: rr.unita }); }
      B.push(h3(`Tipologico ${n} – ${pa.nome ?? pa.id}`), p(`Riferimento OBO: ${pa.id}`, { dimensione: 9, spazioDopo: 2 }),
        tab(["Art. No", "Tipo │ DESCRIZIONE", "Qty TOT (m / pz)", "Qty tipico"], [...unite.values()].map((u) => [[{ t: u.codice || "—", b: true }], u.descrizione.replace(/ – /, " │ "), `${it(u.q)} ${u.unita}`, tipica(u.codice)]), [1.6, 6.5, 1.8, 1.6]),
      );
      // disegno: tipologico disegnato nell'app, scheda PDF dell'archivio, altrimenti schema indicativo dai componenti
      const dis = pa.disegno ? disegnoSchema.safeParse(pa.disegno) : null;
      if (dis?.success && dis.data.blocchi.length) {
        const svg = svgTipologico(dis.data, { legenda: true, obo: x.disegniObo ?? null }), w = Number(svg.match(/width="(\d+)"/)?.[1] ?? 800), h = Number(svg.match(/height="(\d+)"/)?.[1] ?? 500);
        B.push({ tipo: "immagine", svg, larghezza: 16, altezza: Math.round((16 * h / w) * 100) / 100 }, p([{ t: `Figura ${++nFig} – `, b: true }, { t: `Tipologico ${n}: ${pa.nome ?? pa.id}` }], { allinea: "centro", dimensione: 9 }));
      } else if (pa.immagine) {
        B.push({ tipo: "immagine", svg: "", pdf: pa.immagine, larghezza: 16, altezza: 11, mancante: `scheda ${pa.immagine} non trovata nell'archivio dei particolari: inserire il disegno del tipologico` });
        B.push(p([{ t: `Figura ${++nFig} – `, b: true }, { t: `Tipologico ${n}: ${pa.nome ?? pa.id} (scheda OBO ${pa.id})` }], { dimensione: 9 }));
      } else if (pa.componenti.some((k) => ruoloDi(k.descrizione) !== "conduttore")) {
        const auto = disegnoDaComponenti(pa.componenti.map((k) => ({ codiceOBO: k.codiceOBO, descrizione: k.descrizione, quantita: k.quantita ?? 1, unitaQuantita: k.unitaQuantita ?? "fisso" })));
        const svg = svgTipologico(auto, { legenda: true }), w = Number(svg.match(/width="(\d+)"/)?.[1] ?? 800), h = Number(svg.match(/height="(\d+)"/)?.[1] ?? 500);
        B.push({ tipo: "immagine", svg, larghezza: 16, altezza: Math.round((16 * h / w) * 100) / 100 }, p([{ t: `Figura ${++nFig} – `, b: true }, { t: `Tipologico ${n}: ${pa.nome ?? pa.id} – schema indicativo dei componenti (si può ridisegnare in Particolari → Disegna)` }], { allinea: "centro", dimensione: 9 }));
      }
    }
  } else B.push(p([dc("nessun particolare costruttivo collegato alle righe del computo")]));

  // ---------- 15 elenco materiale
  B.push(h1("15. Elenco materiale"));
  if (x.righe.length) {
    for (const cat of categorie) {
      const gr = x.righe.filter((rr) => rr.categoria === cat); if (!gr.length) continue;
      B.push(h3(cat.charAt(0).toUpperCase() + cat.slice(1)), tab(["Art. No", "Descrizione", "Quantità", "Unità"], gr.map((rr) => [rr.codice || "Da assegnare", rr.descrizione, it(rr.quantita), rr.unita]), [1.6, 7.5, 1.5, 1]));
    }
    if (x.mancanti.length) B.push(p([{ t: "Computo incompleto – dati mancanti: ", b: true }, { t: x.mancanti.join("; ") }], { dimensione: 9 }));
  } else B.push(p([dc("elenco materiale (pagina Computo materiali)")]));

  // ---------- 16 verifiche
  B.push(h1("16. Verifiche e manutenzione"),
    p("Al termine dei lavori l'installatore rilascia la dichiarazione di conformità ai sensi del D.M. 37/2008. L'impianto è soggetto alla denuncia e alle verifiche periodiche previste dal D.P.R. 462/2001. L'LPS deve essere esaminato a vista periodicamente e verificato in modo completo secondo il piano di manutenzione della CEI EN IEC 62305-3:2026-10, e comunque dopo ogni fulminazione accertata o modifica della struttura."));

  // ---------- 17 NG-NSG
  B.push(h1("17. Valori NG – NSG (CEI EN IEC 62305 – CEI EN IEC 62858)"),
    tab(["", ""], [
      [[...pedice("N", "G")], `${it(d.densita)} fulmini/(anno·km²)`],
      [[...pedice("N", "SG")], `${it(r.nsgAttestato ?? k * d.densita)} punti/(anno·km²)`],
      ["Latitudine", typeof d.lat === "number" ? `${d.lat.toFixed(6).replace(".", ",")}° N` : [dc("latitudine")]],
      ["Longitudine", typeof d.lon === "number" ? `${d.lon.toFixed(6).replace(".", ",")}° E` : [dc("longitudine")]],
    ], [4, 8]),
    p("I valori di NG (numero medio di fulmini a terra all'anno e al kilometro quadrato) e NSG (numero medio dei punti di impatto a terra all'anno e al kilometro quadrato) sono riferiti alle coordinate geografiche della struttura (WGS84) e sono riportati nell'attestato rilasciato dal fornitore dei dati secondo la CEI EN IEC 62858, allegato in originale alla presente relazione con le sue condizioni d'uso e la sua validità temporale."),
    p([{ t: "Attestato: " }, ...(r.ngFornitore ? [{ t: `${r.ngFornitore}${r.ngData ? ` – ${dataIt(r.ngData)}` : ""}` }] : [dc("fornitore, numero e data dell'attestato NG/NSG")])]),
  );

  B.push(h1("18. Allegati"), el("Attestato dei valori NG e NSG (CEI EN IEC 62858)", "Disegni di posizionamento del sistema di captazione e delle calate (DWG/DXF)", "Schede dei particolari costruttivi OBO", "Elenco materiale (Excel)"),
    ...(x.creditoStemma ? [p(x.creditoStemma, { dimensione: 8, spazioPrima: 8 })] : []),
    p("Calcoli di supporto alla progettazione eseguiti con OBO Hub · Progettazione LPS (CEI EN IEC 62305:2026-10). Il documento va verificato, completato nelle parti evidenziate e firmato da un tecnico abilitato.", { dimensione: 9, spazioPrima: 12 }),
    p([{ t: `${r.luogo || "Rivoli"}, ${dataLunga(x.data)}` }], { spazioPrima: 18 }),
    p([{ t: "Il tecnico", b: true }], { allinea: "destra", spazioPrima: 12, spazioDopo: 2 }),
    p(r.tecnico ? [{ t: formattaNome(r.tecnico) + (r.albo ? `\n${r.albo}` : "") }] : [dc("nome e iscrizione all'albo")], { allinea: "destra", spazioDopo: 30 }),
    p("______________________________", { allinea: "destra" }),
  );

  const documento: Documento = {
    titolo: `Relazione LPS – ${titolo || d.comune || "progetto"}`,
    intestazione: `${titolo || "Relazione tecnica LPS"}${d.comune ? ` – ${d.comune}` : ""} · Relazione impianto di protezione dalle scariche atmosferiche${rev ? ` · Rev. ${rev}` : ""}`,
    piede: [
      [{ t: "OBO Bettermann S.r.l.", b: true }, { t: " a socio unico · Via Ferrero 16 – 10098 Cascine Vica Rivoli (TO) · Tel. +39 011 9548 811 · Fax +39 011 9548 899" }],
      "R.E.A. n° 1035379 – Registro Imprese n° 09227890010 Trib. di Torino – Cap. Soc. € 300.000 i.v. – C.Fisc./P.IVA 09227890010",
      "Società soggetta all'attività di direzione e coordinamento di Arvigrat Holding AG",
    ],
    blocchi: B,
  };
  return r.lingua === "en" ? traduciDocumento(documento) : documento;
}

/** RT usato (per i controlli esterni). */
export const RISCHIO_TOLLERABILE = RT;
