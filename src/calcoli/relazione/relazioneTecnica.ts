/**
 * Relazione tecnica dell'impianto di protezione dalle scariche atmosferiche, sul modello della relazione OBO
 * (format di Marco Lo Vetere, novembre 2025) aggiornato all'edizione 2024 della CEI EN IEC 62305.
 *
 * Testo descrittivo: tutto quello del format OBO (stessi capitoli e paragrafi, in due parti: relazione
 * dell'impianto e "Valutazione del rischio e scelta delle misure di protezione"), corretto solo dove
 * l'edizione 2024 cambia le cose (un solo rischio R = RL1 + RL2 e frequenza del danno F al posto di R2, R3, R4;
 * EN 50164 sostituita dalla serie EN IEC 62561). Le definizioni sono scritte con parole nostre: nessun testo o
 * figura della norma è copiato, solo valori e riferimenti.
 * Valori del progetto: dai dati e dai calcoli dell'app. Le parti che l'app non conosce (sopralluogo,
 * fotografie, scelte del progettista) restano evidenziate in giallo "[DA COMPLETARE …]".
 * Logica pura: nessun accesso a stato, DOM o rete.
 */
import type { Blocco, Documento, Run, Testo } from "@/lib/docx";
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
import { barreLog, curvaCorrente, flussoValutazione, graficoSeparazione, graficoSfera, piantaCopertura, schemaSorgenti } from "./grafici";

export type Lpl = "I" | "II" | "III" | "IV";

/** Dati della relazione che l'app non calcola (salvati nel progetto). */
export interface DatiRelazione {
  committente: string; indirizzoCommittente: string; cittaCommittente: string;
  provincia: string; titoloOpera: string; destinazione: string; luogo: string;
  /** testo libero: sopralluogo, impianti esistenti, scelte del progettista */
  descrizione: string;
}
export const datiRelazioneVuoti: DatiRelazione = { committente: "", indirizzoCommittente: "", cittaCommittente: "", provincia: "", titoloOpera: "", destinazione: "", luogo: "Rivoli", descrizione: "" };

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
  /** immagini già pronte (PNG o JPEG): logo OBO, stemma del Comune, logo del committente, foto e planimetrie */
  immagini?: { logo?: ImmagineIn | undefined; stemma?: ImmagineIn | undefined; logoCommittente?: ImmagineIn | undefined; foto?: { img: ImmagineIn; didascalia: string }[] | undefined } | undefined;
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
  if (breve) return lib.find((x) => x.id.endsWith(`-${breve}`)) ?? null;
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
  const destinazione: Run[] = r.destinazione ? [{ t: r.destinazione }] : [dc("destinazione d'uso")];
  const committente: Run[] = r.committente ? [{ t: r.committente, b: true }] : [dc("committente")];
  const indirizzoComm: Run[] = r.indirizzoCommittente || r.cittaCommittente ? [{ t: [r.indirizzoCommittente, r.cittaCommittente].filter(Boolean).join("\n") }] : [dc("indirizzo del committente")];

  const im = x.immagini ?? {};
  const copertina = (sottotitolo: string, seconda?: string) => B.push(
    ...(im.logo ? [bloccoImmagine(im.logo, 4.2, "sinistra", 3)] : []),
    p([{ t: "OBO Bettermann S.r.l.", b: true }], { allinea: "destra", dimensione: 11, spazioDopo: 0 }),
    p("Via C. Ferrero 16 · 10098 Rivoli (TO)\nTel. +39 011 9548 811\ntecnico@obo.it · www.obo.it", { allinea: "destra", dimensione: 9 }),
    p("", { spazioPrima: im.stemma ? 20 : 50 }),
    ...(im.stemma ? [bloccoImmagine(im.stemma, 2.6, "centro", 3.2)] : []),
    p(d.comune ? `COMUNE DI ${d.comune.toUpperCase()}` : [dc("comune")], { allinea: "centro", grassetto: true, dimensione: 14, spazioDopo: 2 }),
    p(r.provincia ? `PROVINCIA DI ${r.provincia.toUpperCase()}` : [dc("provincia")], { allinea: "centro", grassetto: true, dimensione: 12, spazioDopo: 30 }),
    p(titolo ? titolo.toUpperCase() : [dc("titolo dell'opera")], { allinea: "centro", grassetto: true, dimensione: 16, spazioDopo: 30 }),
    p(sottotitolo, { allinea: "centro", grassetto: true, dimensione: 18, spazioDopo: 10 }),
    ...(seconda ? [p(seconda, { allinea: "centro", grassetto: true, dimensione: 13, spazioDopo: 10 })] : []),
    p(`CEI EN IEC 62305:2024 · Livello di protezione (LPL) ${lpl}`, { allinea: "centro", dimensione: 11, spazioDopo: 50 }),
    p("Committente", { allinea: "centro", dimensione: 11, spazioDopo: 4 }),
    ...(im.logoCommittente ? [bloccoImmagine(im.logoCommittente, 4, "centro", 2)] : []),
    p(committente, { allinea: "centro", dimensione: 13, spazioDopo: 2 }),
    p(indirizzoComm, { allinea: "centro", spazioDopo: 50 }),
    p(`${r.luogo || "Rivoli"}, ${dataLunga(x.data)}`, { allinea: "centro", dimensione: 11 }),
    p([x.codice ? `Progetto n. ${x.codice}` : "", rev ? `Rev. ${rev}` : "Bozza"].filter(Boolean).join(" · "), { allinea: "centro", dimensione: 9 }),
    { tipo: "salto" },
  );

  // =====================================================================================
  // PARTE 1 – RELAZIONE IMPIANTO DI PROTEZIONE DALLE SCARICHE ATMOSFERICHE
  // =====================================================================================
  copertina("Relazione impianto di protezione\ndalle scariche atmosferiche");
  if (x.revisioni.length) B.push(h3("Revisioni del documento"), tab(["Rev.", "Data", "Descrizione", "Autore"], x.revisioni.map((v) => [v.rev, new Date(v.data).toLocaleDateString("it-IT"), v.descrizione, v.autore]), [1, 2, 6, 3]));

  // ---------- 1 Premessa
  B.push(h1("1. Premessa"),
    p([{ t: "Scopo del presente documento è la descrizione (ai sensi del D.M. 22 gennaio 2008, n. 37) della realizzazione dell'impianto di protezione dalle scariche atmosferiche per la struttura " }, ...(titolo ? [{ t: `denominata «${titolo}»` }] : [dc("nome della struttura")]), { t: ` ubicata a ${d.comune || "…"}${r.provincia ? ` (${r.provincia})` : ""}${d.indirizzo ? `, ${d.indirizzo},` : ""} e destinata a: ` }, ...destinazione, { t: "." }]),
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
    el("CEI EN IEC 62305-1:2024 – Protezione contro i fulmini. Parte 1: Principi generali",
      "CEI EN IEC 62305-2:2024 – Protezione contro i fulmini. Parte 2: Valutazione del rischio",
      "CEI EN IEC 62305-3:2024 – Protezione contro i fulmini. Parte 3: Danno materiale alle strutture e pericolo per le persone",
      "CEI EN IEC 62305-4:2024 – Protezione contro i fulmini. Parte 4: Impianti elettrici ed elettronici nelle strutture",
      "CEI EN IEC 62561 serie da 1 a 8 – Componenti dei sistemi di protezione contro i fulmini (LPSC, Lightning Protection System Components). Sono gli adeguamenti della norma europea EN alla norma internazionale IEC e sostituiscono la serie CEI EN 50164 (CEI 81-5)",
      "CEI EN IEC 62858 – Densità di fulminazione. Reti di localizzazione fulmini (LLS) – Principi generali",
      "CEI 81-29 – Linee guida per l'applicazione delle norme CEI EN 62305",
      "CEI 64-8 – Impianti elettrici utilizzatori a tensione nominale non superiore a 1000 V in corrente alternata e a 1500 V in corrente continua",
      "CEI 11-1 – Impianti elettrici con tensione superiore a 1 kV in corrente alternata",
      "CEI EN 50522 – Messa a terra degli impianti elettrici a tensione superiore a 1 kV in c.a.",
      "DPR 462/01 – Procedimento per la denuncia di installazioni e dispositivi di protezione contro le scariche atmosferiche, di dispositivi di messa a terra di impianti elettrici e di impianti elettrici pericolosi",
      "CEI 64-12 – Guida per l'esecuzione dell'impianto di terra negli edifici per uso residenziale e terziario",
      "CEI 11-37 – Guida per l'esecuzione degli impianti di terra nei sistemi utilizzatori di energia alimentati a tensione maggiore di 1 kV"),
    p("Le norme CEI EN IEC 62305:2024 sostituiscono l'edizione 2013 (CEI EN 62305, CEI 81-10/1…4). I valori e i metodi riportati nel documento sono quelli dell'edizione 2024.", { dimensione: 9 }),
  );

  // ---------- 4 Descrizione
  B.push(h1("4. Descrizione"),
    p("Questa fase prevede la progettazione e la realizzazione di un sistema di protezione contro le fulminazioni dirette (LPS), coordinato con l'impianto di terra e con le misure di protezione degli impianti interni (SPD)."));

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

  // ---------- 6 Valutazione del rischio (parte generale)
  const si = (ok: boolean, nota = ""): Testo => (ok ? `SI${nota}` : "NO");
  B.push(h1("6. Valutazione del rischio fulminazione"),
    p("La normativa CEI EN IEC 62305-2:2024 specifica una procedura per la valutazione del rischio dovuto a fulminazione e, se necessario, individua le misure di protezione da realizzare per ridurre il rischio a valori non superiori a quello ritenuto tollerabile dalla norma."),
    h2("6.1 Sorgente di rischio, S"),
    p("La corrente di fulmine è la principale sorgente di danno. Le sorgenti sono distinte in base al punto d'impatto del fulmine."),
    el("S1 – Fulmine sulla struttura.", "S2 – Fulmine in prossimità della struttura.", "S3 – Fulmine su una linea.", "S4 – Fulmine in prossimità di una linea."),
  );
  fig(schemaSorgenti(), "Sorgenti di danno in base al punto d'impatto del fulmine (schema)");
  B.push(
    h2("6.2 Tipo di danno, D"),
    p("Un fulmine può causare danni in funzione delle caratteristiche dell'oggetto da proteggere. Nelle pratiche applicazioni della determinazione del rischio è utile distinguere tra i tre tipi principali di danno che possono manifestarsi come conseguenza di una fulminazione:"),
    el("D1 – Danno ad esseri viventi per elettrocuzione.", "D2 – Danno materiale.", "D3 – Guasto di impianti elettrici ed elettronici."),
    h2("6.3 Tipo di perdita, L"),
    p("Ciascun tipo di danno, solo o in combinazione con altri, può produrre diverse perdite conseguenti nell'oggetto da proteggere. Il tipo di perdita che può verificarsi dipende dalle caratteristiche dell'oggetto stesso e dal suo contenuto. L'edizione 2024 della norma considera due tipi di perdita:"),
    el("L1 – Perdita di vite umane (compreso danno permanente).", "L2 – Perdita per danno materiale (struttura e contenuto, compresi servizi pubblici e patrimonio culturale ospitati nella struttura)."),
    p("La perdita di servizio pubblico, di patrimonio culturale insostituibile e la perdita economica, che nell'edizione 2013 erano valutate con i rischi R2, R3 e R4, sono ora comprese nella perdita L2 per la parte di danno materiale; il guasto degli impianti interni si valuta con la frequenza del danno F (vedi 6.10)."),
    h2("6.4 Rischio, R"),
    p("Il rischio R è la misura della probabile perdita media annua. Per la struttura (o per ciascuna sua zona ZS) si valuta un unico rischio, somma dei rischi per i due tipi di perdita:"),
    p([{ t: "R = R" }, { t: "L1", sub: true }, { t: " + R" }, { t: "L2", sub: true }], { formula: true }),
    el([{ t: "R" }, { t: "L1", sub: true }, { t: " – rischio di perdita di vite umane (inclusi danni permanenti);" }], [{ t: "R" }, { t: "L2", sub: true }, { t: " – rischio di perdita per danno materiale." }]),
    h2("6.5 Rischio tollerabile, RT, e frequenza tollerabile, FT"),
    p("Il valore del rischio tollerabile RT è stabilito dalla norma CEI EN IEC 62305-2:2024:"),
    el([{ t: "rischio tollerabile per perdita di vite umane e per danno materiale: RT = 10" }, { t: "-5", sup: true }, { t: " anni" }, { t: "-1", sup: true }, { t: "." }]),
    p("Per il guasto degli impianti interni si confronta la frequenza del danno F con la frequenza tollerabile FT:"),
    el([{ t: "FT = 0,1 anni" }, { t: "-1", sup: true }, { t: " per impianti interni critici per la sicurezza o per il servizio;" }], [{ t: "FT = 1 anni" }, { t: "-1", sup: true }, { t: " negli altri casi, salvo valore diverso stabilito dal proprietario della struttura." }]),
  );
  tabN("Valori tollerabili (CEI EN IEC 62305-2:2024)", ["Grandezza", "Valore tollerabile", "Applicazione"], [
    [[{ t: "RT" }], [{ t: "10" }, { t: "-5", sup: true }, { t: " anni" }, { t: "-1", sup: true }], "Rischio R = RL1 + RL2 di ogni zona"],
    [[{ t: "FT" }], [{ t: "0,1 anni" }, { t: "-1", sup: true }], "Frequenza del danno con impianti interni critici"],
    [[{ t: "FT" }], [{ t: "1 anni" }, { t: "-1", sup: true }], "Frequenza del danno negli altri casi"],
  ], [2, 3, 6]);
  B.push(
    h2("6.6 Componenti di rischio per tipo di perdita"),
    p("Per ogni tipo di perdita (e per la frequenza del danno), nella tabella seguente sono riportate le componenti che vi contribuiscono:"),
    tab(["Sorgente", "S1", "S1", "S1", "S2", "S3", "S3", "S3", "S4"], [
      ["Danno", "D1", "D2", "D3", "D3", "D1", "D2", "D3", "D3"],
      [[{ t: "Componente", b: true }], [{ t: "RA", b: true }], [{ t: "RB", b: true }], [{ t: "RC", b: true }], [{ t: "RM", b: true }], [{ t: "RU", b: true }], [{ t: "RV", b: true }], [{ t: "RW", b: true }], [{ t: "RZ", b: true }]],
      [[{ t: "R" }, { t: "L1", sub: true }], si(true), si(true), si(true, " (1)"), si(true, " (1)"), si(true), si(true), si(true, " (1)"), si(true, " (1)")],
      [[{ t: "R" }, { t: "L2", sub: true }], si(false), si(true), si(true, " (2)"), si(true, " (2)"), si(false), si(true), si(true, " (2)"), si(true, " (2)")],
      ["F", si(false), si(false), "FC", "FM", si(false), si(false), "FW", "FZ"],
    ], [2, 1, 1, 1.2, 1.2, 1, 1, 1.2, 1.2]),
    el("(1) Solo nelle strutture con rischio di esplosione, negli ospedali o nelle altre strutture in cui il guasto degli impianti interni provoca immediato pericolo per la vita umana.", "(2) Solo nelle strutture con rischio di esplosione."),
    p("RA comprende anche la componente per le persone esposte al fulmine diretto in copertura, terrazze o aree esterne della struttura, se presenti.", { dimensione: 9 }),
    h2("6.7 Metodo di valutazione"),
    p("Ai fini della valutazione del rischio si deve provvedere a:"),
    el("determinare le componenti RA, RB, RC, RM, RU, RV, RW e RZ che lo compongono;", "determinare il corrispondente valore del rischio R;", "confrontare il rischio R con quello tollerabile RT;", "determinare la frequenza del danno F e confrontarla con FT."),
    p("Per ciascuna zona della struttura devono essere effettuati i seguenti passi (vedi anche la figura successiva):"),
    el("identificazione delle componenti RX che contribuiscono al rischio;", "calcolo della componente di rischio identificata RX;", "calcolo del rischio totale R;", "identificazione del rischio tollerabile RT;", "confronto del rischio R con quello tollerabile RT."),
  );
  fig(flussoValutazione(), "Procedura di valutazione del rischio e scelta delle misure di protezione (schema)");
  B.push(
    p("Se R ≤ RT la protezione contro il fulmine non è necessaria."),
    p("Se R > RT devono essere adottate misure di protezione al fine di rendere R ≤ RT in tutte le zone della struttura. Analogamente, se F > FT devono essere adottate misure di protezione degli impianti interni (SPM) al fine di rendere F ≤ FT."),
    p("La valutazione della convenienza economica della protezione, prevista dall'edizione 2013 con il rischio R4, non fa più parte della norma; può essere condotta a parte su richiesta del committente."),
    h2("6.8 Componenti di rischio"),
    p("Le componenti di rischio sono raggruppate secondo la sorgente di danno ed il tipo di danno, come si evince dalla precedente tabella. Ciascuna delle componenti di rischio può essere calcolata mediante la seguente equazione generale:"),
    p([...pedice("R", "X"), { t: " = " }, ...pedice("N", "X"), { t: " × " }, ...pedice("P", "X"), { t: " × " }, ...pedice("L", "X")], { formula: true }),
    p("dove:"),
    el([...pedice("N", "X"), { t: " è il numero di eventi pericolosi [Allegato A, CEI EN IEC 62305-2:2024];" }], [...pedice("P", "X"), { t: " è la probabilità di danno alla struttura [Allegato B, CEI EN IEC 62305-2:2024];" }], [...pedice("L", "X"), { t: " è la perdita conseguente [Allegato C, CEI EN IEC 62305-2:2024]." }]),
  );
  const ND = (): Testo => [...pedice("N", "D"), { t: " – numero di eventi pericolosi per fulminazione diretta della struttura [Allegato A, CEI EN IEC 62305-2:2024];" }];
  const NLD = (): Testo => [...pedice("N", "L"), { t: " – numero di eventi pericolosi per fulminazione sul servizio [Allegato A];" }];
  const NDJ = (): Testo => [...pedice("N", "DJ"), { t: " – numero di eventi pericolosi per fulminazione diretta della struttura adiacente all'estremità della linea [Allegato A];" }];
  const componente = (titoloC: string, testo: string, formula: Run[], dove: Testo[]) => B.push(h3(titoloC), p(testo), p(formula, { formula: true }), p("dove:"), el(...dove));
  componente("Componente di rischio (danno ad esseri viventi – fulmine sulla struttura), RA",
    "Componente relativa ai danni ad esseri viventi dovuti a tensioni di contatto e di passo in zone fino a 3 m all'esterno della struttura e, se presenti, alle persone esposte in copertura o nelle aree esterne della struttura. Possono verificarsi perdite di tipo L1 (perdita di vite umane); nelle strutture ad uso agricolo è possibile anche la perdita di animali.",
    [...pedice("R", "A"), { t: " = " }, ...pedice("N", "D"), { t: " × " }, ...pedice("P", "A"), { t: " × " }, ...pedice("L", "A")],
    [ND(), [...pedice("P", "A"), { t: " – probabilità di danno ad esseri viventi (fulmine sulla struttura) [Allegato B];" }], [...pedice("L", "A"), { t: " – perdita per danno ad esseri viventi [Allegato C]." }]]);
  componente("Componente di rischio (danno materiale alla struttura – fulmine sulla struttura), RB",
    "Componente relativa ai danni materiali causati da scariche pericolose all'interno della struttura che innescano l'incendio e l'esplosione e che possono essere pericolose anche per l'ambiente. Possono verificarsi perdite di tipo L1 (perdita di vite umane) e L2 (danno materiale alla struttura e al contenuto).",
    [...pedice("R", "B"), { t: " = " }, ...pedice("N", "D"), { t: " × " }, ...pedice("P", "B"), { t: " × " }, ...pedice("L", "B")],
    [ND(), [...pedice("P", "B"), { t: " – probabilità di danno materiale in una struttura (fulmine sulla struttura), che tiene conto delle misure antincendio rp e del rischio d'incendio rf [Allegato B];" }], [...pedice("L", "B"), { t: " – perdita per danno materiale in una struttura (fulmine sulla struttura) [Allegato C]." }]]);
  componente("Componente di rischio (guasto di impianti interni – fulmine sulla struttura), RC",
    "Componente relativa al guasto di impianti interni causato dal LEMP (impulso elettromagnetico del fulmine). Entra nel rischio di perdita di vite umane L1 nelle strutture con rischio di esplosione, negli ospedali e nelle altre strutture in cui il guasto degli impianti interni provoca immediato pericolo per la vita umana, e nel rischio L2 nelle strutture con rischio di esplosione. In tutti i casi contribuisce alla frequenza del danno F (FC).",
    [...pedice("R", "C"), { t: " = " }, ...pedice("N", "D"), { t: " × " }, ...pedice("P", "C"), { t: " × " }, ...pedice("L", "C")],
    [ND(), [...pedice("P", "C"), { t: " – probabilità di guasto di un impianto interno (fulmine sulla struttura) [Allegato B];" }], [...pedice("L", "C"), { t: " – perdita per guasto di un impianto interno (fulmine sulla struttura) [Allegato C]." }]]);
  componente("Componente di rischio (guasto di impianti interni – fulmine in prossimità della struttura), RM",
    "Componente relativa al guasto di impianti interni causato dal LEMP (impulso elettromagnetico del fulmine) di un fulmine che cade vicino alla struttura. Vale quanto detto per RC; contribuisce alla frequenza del danno F (FM).",
    [...pedice("R", "M"), { t: " = " }, ...pedice("N", "M"), { t: " × " }, ...pedice("P", "M"), { t: " × " }, ...pedice("L", "M")],
    [[...pedice("N", "M"), { t: " – numero di eventi pericolosi per fulminazione in prossimità della struttura [Allegato A];" }], [...pedice("P", "M"), { t: " – probabilità di guasto di un impianto interno (fulmine in prossimità della struttura) [Allegato B];" }], [...pedice("L", "M"), { t: " – perdita per guasto di un impianto interno (fulmine in prossimità della struttura) [Allegato C]." }]]);
  componente("Componente di rischio (danno ad esseri viventi – fulmine sul servizio connesso), RU",
    "Componente relativa ai danni ad esseri viventi dovuti a tensioni di contatto all'interno della struttura causate dalla corrente di fulmine iniettata nella linea entrante. Possono verificarsi perdite di tipo L1 (perdita di vite umane); nelle strutture ad uso agricolo è possibile anche la perdita di animali.",
    [...pedice("R", "U"), { t: " = (" }, ...pedice("N", "L"), { t: " + " }, ...pedice("N", "DJ"), { t: ") × " }, ...pedice("P", "U"), { t: " × " }, ...pedice("L", "U")],
    [NLD(), NDJ(), [...pedice("P", "U"), { t: " – probabilità di danno ad esseri viventi (fulmine sul servizio connesso) [Allegato B];" }], [...pedice("L", "U"), { t: " – perdita per danni ad esseri viventi (fulmine sul servizio) [Allegato C]." }]]);
  componente("Componente di rischio (danno materiale alla struttura – fulmine sul servizio connesso), RV",
    "Componente relativa ai danni materiali (incendio o esplosione innescati da scariche pericolose fra installazioni esterne e parti metalliche, generalmente nel punto d'ingresso della linea nella struttura) dovuti alla corrente di fulmine trasmessa attraverso il servizio entrante. Possono verificarsi perdite di tipo L1 (perdita di vite umane) e L2 (danno materiale).",
    [...pedice("R", "V"), { t: " = (" }, ...pedice("N", "L"), { t: " + " }, ...pedice("N", "DJ"), { t: ") × " }, ...pedice("P", "V"), { t: " × " }, ...pedice("L", "V")],
    [NLD(), NDJ(), [...pedice("P", "V"), { t: " – probabilità di danno materiale nella struttura (fulmine sul servizio connesso) [Allegato B];" }], [...pedice("L", "V"), { t: " – perdita per danno materiale in una struttura (fulmine sul servizio) [Allegato C]." }]]);
  componente("Componente di rischio (guasto di impianti interni – fulmine sul servizio connesso), RW",
    "Componente relativa al guasto di impianti interni causato da sovratensioni trasmesse dalla linea alla struttura. Vale quanto detto per RC riguardo alle perdite L1 e L2; contribuisce alla frequenza del danno F (FW).",
    [...pedice("R", "W"), { t: " = (" }, ...pedice("N", "L"), { t: " + " }, ...pedice("N", "DJ"), { t: ") × " }, ...pedice("P", "W"), { t: " × " }, ...pedice("L", "W")],
    [NLD(), NDJ(), [...pedice("P", "W"), { t: " – probabilità di guasto di un impianto interno (fulmine sul servizio connesso) [Allegato B];" }], [...pedice("L", "W"), { t: " – perdita per guasto di un impianto interno (fulmine sul servizio) [Allegato C]." }]]);
  componente("Componente di rischio (guasto di impianti interni – fulmine in prossimità di un servizio connesso), RZ",
    "Componente relativa al guasto di impianti interni causato da sovratensioni indotte sulla linea e trasmesse alla struttura. Vale quanto detto per RC riguardo alle perdite L1 e L2; contribuisce alla frequenza del danno F (FZ).",
    [...pedice("R", "Z"), { t: " = " }, ...pedice("N", "I"), { t: " × " }, ...pedice("P", "Z"), { t: " × " }, ...pedice("L", "Z")],
    [[...pedice("N", "I"), { t: " – numero di eventi pericolosi per fulminazione in prossimità del servizio [Allegato A];" }], [...pedice("P", "Z"), { t: " – probabilità di guasto di un impianto interno (fulmine in prossimità del servizio) [Allegato B];" }], [...pedice("L", "Z"), { t: " – perdita per guasto di un impianto interno (fulmine in prossimità del servizio) [Allegato C]." }]]);
  const elencoComp = (): Testo[] => [
    "RA – componente di rischio (danno ad esseri viventi – fulmine sulla struttura);", "RB – componente di rischio (danno materiale alla struttura – fulmine sulla struttura);",
    "RC – componente di rischio (guasto di impianti interni – fulmine sulla struttura);", "RM – componente di rischio (guasto di impianti interni – fulmine in prossimità della struttura);",
    "RU – componente di rischio (danno ad esseri viventi – fulmine sul servizio connesso);", "RV – componente di rischio (danno materiale alla struttura – fulmine sul servizio connesso);",
    "RW – componente di rischio (guasto di impianti interni – fulmine sul servizio connesso);", "RZ – componente di rischio (guasto di impianti interni – fulmine in prossimità di un servizio connesso).",
  ];
  B.push(h2("6.9 Determinazione del rischio, R"),
    p("Il rischio di perdita di vite umane è determinato come somma delle componenti di rischio precedentemente definite:"),
    p([{ t: "R" }, { t: "L1", sub: true }, { t: " = RA + RB + RC" }, { t: "(1)", sup: true }, { t: " + RM" }, { t: "(1)", sup: true }, { t: " + RU + RV + RW" }, { t: "(1)", sup: true }, { t: " + RZ" }, { t: "(1)", sup: true }], { formula: true }),
    p("(1) Nel caso di strutture con rischio di esplosione, di ospedali o di altre strutture in cui guasti di impianti interni provocano immediato pericolo per la vita umana.", { dimensione: 9 }),
    p("Il rischio di perdita per danno materiale è determinato dalla formula:"),
    p([{ t: "R" }, { t: "L2", sub: true }, { t: " = RB + RC" }, { t: "(2)", sup: true }, { t: " + RM" }, { t: "(2)", sup: true }, { t: " + RV + RW" }, { t: "(2)", sup: true }, { t: " + RZ" }, { t: "(2)", sup: true }], { formula: true }),
    p("(2) Solo nelle strutture con rischio di esplosione.", { dimensione: 9 }),
    p([{ t: "Il rischio della zona è R = R" }, { t: "L1", sub: true }, { t: " + R" }, { t: "L2", sub: true }, { t: ". Se il danno può coinvolgere l'ambiente circostante (esplosione, fumi tossici, inquinamento) si aggiungono le componenti dell'Allegato E della norma. Dove:" }]),
    el(...elencoComp()),
    h2("6.10 Determinazione della frequenza del danno, F"),
    p("La frequenza del danno agli impianti interni, che sostituisce la valutazione dei rischi di perdita di servizio pubblico (R2) e di perdita economica (R4) dell'edizione 2013, è data dalla formula:"),
    p([{ t: "F = F" }, { t: "C", sub: true }, { t: " + F" }, { t: "M", sub: true }, { t: " + F" }, { t: "W", sub: true }, { t: " + F" }, { t: "Z", sub: true }], { formula: true }),
    p("dove:"),
    el([...pedice("F", "C"), { t: " = ND × PC – guasto degli impianti interni per fulmine sulla struttura;" }], [...pedice("F", "M"), { t: " = NM × PM – guasto per fulmine in prossimità della struttura;" }], [...pedice("F", "W"), { t: " = (NL + NDJ) × PW – guasto per fulmine sul servizio connesso;" }], [...pedice("F", "Z"), { t: " = NI × PZ – guasto per fulmine in prossimità del servizio." }]),
    h2("6.11 Esito della valutazione"),
    p("Una volta noti i valori di rischio e di frequenza del danno per la struttura bisogna verificare che essi siano inferiori ai valori tollerabili."),
    p([{ t: "Caso 1 – Struttura autoprotetta", b: true }]),
    p("Se per ogni zona i valori calcolati sono inferiori a RT e FT e non sono state adottate misure di protezione, la struttura oggetto di verifica può considerarsi \"Autoprotetta\"."),
    p([{ t: "Caso 2 – Struttura protetta", b: true }]),
    p("Se per ogni zona i valori calcolati sono inferiori a RT e FT e sono state adottate misure di protezione, la struttura oggetto di verifica può considerarsi \"Protetta\"."),
    p([{ t: "Caso 3 – Struttura NON protetta", b: true }]),
    p("Se almeno un valore calcolato è superiore al rispettivo valore tollerabile devono essere adottate misure di protezione al fine di renderlo inferiore."),
  );

  // ---------- 7 LPS esterno
  const IMIN: Record<Lpl, number> = { I: 3, II: 5, III: 10, IV: 16 };
  const col = LIVELLI.indexOf(lpl) + 1;
  B.push(h1("7. Protezione contro le scariche atmosferiche (LPS esterno) – Lightning Protection System"),
    p("L'LPS esterno ha come ruolo fondamentale quello di intercettare i fulmini prima che entrino nella struttura. La corrente associata al fenomeno di fulminazione, quando esso interessa una struttura metallica collegata a terra, è costretta a fluire sulla stessa fino al terreno; si può dunque assumere in prima approssimazione che l'LPS svolga la funzione di disperdere la corrente di fulmine nel terreno, evitando così che si verifichino danni di tipo meccanico o chimico e scariche pericolose che possano innescare incendi."),
    p("L'impianto di protezione contro i fulmini LPS si compone essenzialmente di:"),
    el("un impianto esterno, costituito da captatori (che intercettano i fulmini diretti sulla struttura);", "calate (che conducono a terra senza danni la corrente di fulmine);", "dispersori (che disperdono a terra tale corrente)."),
    p("Forma, sezione e dimensioni dei conduttori e delle maglie dei captatori, dei conduttori di discesa e del numero dei dispersori si riferiscono alla norma CEI EN IEC 62305-3:2024 e ai componenti della serie CEI EN IEC 62561."),
    p("L'idoneità dell'LPS deve essere verificata in conformità alla norma CEI EN IEC 62305-2:2024."),
    h2("7.1 Impianto di captazione"),
    p("Il posizionamento del sistema di captatori è considerato adeguato quando la struttura che deve essere protetta risulta interamente all'interno del volume protetto dal sistema di captatori. L'impianto di captazione secondo il metodo della sfera rotolante (integrato, dove serve, dal metodo della maglia) prevede l'installazione di una rete di captatori secondo lo schema seguente:"),
  );
  tabN("Parametri della corrente di fulmine e criteri di intercettazione per LPL (CEI EN IEC 62305-1 e -3:2024)", ["Criteri di intercettazione", "I", "II", "III", "IV"], [
      ["Massimo valore della corrente di picco I (kA)", ...LIVELLI.map((l) => String(CORRENTE_LPL[l]))],
      ["Minimo valore della corrente di picco I (kA)", ...LIVELLI.map((l) => String(IMIN[l]))],
      ["Raggio della sfera rotolante R (m)", ...LIVELLI.map((l) => String(par[l]!.raggio))],
      [[{ t: "Lato maglia W" }, { t: "m", sub: true }, { t: " (m)" }], ...LIVELLI.map((l) => `${par[l]!.latoMaglia} × ${par[l]!.latoMaglia}`)],
    ], [5, 1.5, 1.5, 1.5, 1.5], col);
  fig(curvaCorrente(lpl, IMIN[lpl], CORRENTE_LPL[lpl]), `Probabilità che il valore di picco della corrente di fulmine superi I (valori della CEI EN IEC 62305-1:2024, Tab. A.3) con i limiti dell'LPL ${lpl}`);
  B.push(
    p(`Per il presente progetto (LPL ${lpl}, colonna evidenziata): raggio della sfera rotolante ${R} m, lato della maglia ${par[lpl]!.latoMaglia} m.`, { grassetto: true }),
    p("La norma CEI EN IEC 62305-1:2024 definisce i valori minimi dei parametri del fulmine e i relativi raggi massimi della sfera rotolante corrispondenti ai diversi livelli di protezione in funzione non della carica, ma della corrente di fulmine."),
    p("Data una carica elettrica (la testa del futuro fulmine) in un mezzo dielettrico omogeneo, la sfera con il centro sulla stessa carica è il luogo geometrico dei punti che hanno la stessa probabilità di scarica. Il raggio della sfera è funzione, oltre che della probabilità di scarica, anche del valore della carica:"),
    p("R = f(Pr, Q)", { formula: true }),
    el("R – raggio della sfera;", "Pr – probabilità di scarica;", "Q – carica elettrica."),
    p("Il metodo della sfera rotolante prevede il posizionamento dei captatori in modo tale da massimizzare la probabilità che la sfera così descritta abbia il suo punto di contatto con le aste di captazione, in modo da incanalare la scarica elettrica attraverso la maglia di conduzione verso i dispersori di terra."),
    p("Tutti i punti toccati dalla sfera sono quelli che per primi sarebbero oggetto di fulminazione e come tali devono essere protetti con un captatore che, toccato per primo dalla sfera, diventa il punto di impatto del fulmine. Tra due captatori la sfera penetra verso la copertura per una profondità p che dipende dal raggio R e dalla distanza d tra i captatori:"),
    p([{ t: "p = R − √(R² − (d/2)²)" }], { formula: true }),
    p("I componenti naturali costituiti da elementi metallici che sono parte integrante della struttura e che non possono essere modificati facilmente possono essere usati come elementi dell'LPS. Se adeguatamente dimensionati, possono essere usati come componenti naturali del sistema di captatori e, quindi, entrare a far parte dell'LPS i seguenti elementi di una struttura:"),
    el("lastre metalliche di copertura, con gli spessori minimi della tabella seguente;", "componenti metallici costruttivi di tetti (capriate metalliche, ecc.) al di sotto di una copertura non metallica, purché sia accettabile il danneggiamento di quest'ultima;", "parti metalliche come gronde, ornamenti, ringhiere;", "tubazioni e serbatoi metallici sul tetto."),
  );
  tabN("Spessore minimo di lastre e tubazioni metalliche usate come captatori naturali (CEI EN IEC 62305-3:2024, Tab. 3)", ["Materiale", "Spessore t (mm) – senza perforazione", "Spessore t' (mm) – perforazione ammessa"], SPESSORI_LASTRE.map((z) => [NOMI_MATERIALI[z.materiale], z.t != null ? it(z.t) : "—", it(z.t1)]), [4, 4, 4]);
  B.push(p("t: spessore che evita la perforazione o il surriscaldamento nel punto d'impatto, richiesto se sotto la lastra c'è materiale infiammabile; t': spessore minimo quando la perforazione è accettabile.", { dimensione: 8.5 }),
    p("Solo strutture più alte di 60 m possono essere interessate dalla fulminazione anche sulle facciate: in questo caso va protetta anche la parte alta delle facciate."),
    p("La ripartizione della corrente di fulmine sui captatori dipende dal tipo e dal numero degli stessi così come dal numero totale e dal sistema delle calate e dei dispersori. Il punto di impatto è sempre interessato dalla corrente totale indipendentemente dal tipo di captatore e da tutto il resto. Pertanto, un captatore che è colpito da fulmine viene percorso dalla corrente totale; questa corrente poi si ripartisce lungo il sistema secondo il numero di nodi che incontra lungo il percorso verso il dispersore di terra. Per il dimensionamento dei conduttori va fatto necessariamente riferimento al caso più gravoso."),
    p("Nell'installazione dei captatori deve essere mantenuta una distanza minima rispetto a corpi metallici, impianti elettrici, di telecomunicazione e di segnale. Quando la corrente di fulmine percorre l'LPS si manifestano infatti delle cadute di tensione longitudinali che sollecitano l'eventuale isolamento tra detto elemento e le parti che lo circondano."),
    p("Per evitare l'equipotenzializzazione, soluzione da percorrere se non si hanno alternative, occorre prevedere una base del captatore isolante sufficiente a garantire il rispetto della distanza di sicurezza dielettrica, un captatore isolato (es. isFang con conduttore isCon) o un maggiore numero di calate."),
    p("Il calcolo della distanza minima di sicurezza (distanza di separazione s) deve essere condotto facendo riferimento al primo punto equipotenziale con uno dei metodi indicati dalla norma CEI EN IEC 62305-3:2024 (vedi capitolo 13)."),
    p("Va inoltre ricordato che sui tetti piani durante i temporali è previsto un certo accumulo di acqua: per non perdere di efficacia, il sistema di captatori deve essere installato al di sopra del massimo livello probabile dell'acqua. La distanza degli ancoraggi generalmente deve essere pari a 1 m, oppure 0,5 m per nastri, conduttori cordati e massicci non in tiro, conduttori verticali oltre 20 m o conduttori orizzontali su superfici verticali."),
  );
  const dist = (distanzaCalate as unknown as Record<string, { distanzaTipica: number }>)[lpl]?.distanzaTipica ?? 0;
  B.push(h2("7.2 Calate"),
    p("Il sistema delle calate è la parte di LPS esterno destinata alla conduzione della corrente di fulmine dal sistema di captatori al sistema di dispersori."),
    p("Il sistema delle calate comprende in alcuni casi anche dei collegamenti intermedi con lo scopo di:"),
    el("equipotenzializzare, quando la distanza con le parti conduttrici della struttura non garantisce la tenuta dielettrica (mancato rispetto della distanza di sicurezza);", "distribuire la corrente di fulmine tra le calate stesse per mezzo di conduttori ad anello (conduttori disposti ad anello attorno alla struttura che interconnettono le calate per favorire la ripartizione della corrente di fulmine fra esse)."),
    p("Il numero di calate dipende dalla dimensione perimetrale del tetto. La disposizione delle calate deve essere eseguita in modo che, partendo dagli angoli della struttura, le calate siano distribuite il più uniformemente possibile su tutto il perimetro, in modo da costituire la continuazione dei conduttori dal sistema di captazione e da assicurare il più breve e più diretto percorso fino a terra."),
    p("Se la corrente di fulmine è ripartita su diverse calate, è intuitivo comprendere che il rischio di scariche laterali e di disturbi elettromagnetici all'interno della struttura si riduce. Per ridurre la probabilità che la corrente di fulmine attraverso l'LPS provochi un danno, è quindi opportuno che le calate siano disposte in modo parallelo e simmetrico e che le lunghezze dei percorsi siano ridotte al minimo."),
    p("A seconda della struttura (ad esempio portoni, prefabbricati in calcestruzzo) le distanze tra le varie calate possono variare. In ogni caso deve essere rispettato il numero minimo delle calate necessarie, a seconda della classe di LPS."),
    p("Nella norma CEI EN IEC 62305-3:2024 (Tab. 5) vengono elencate le distanze tipiche tra calate e conduttori ad anello, a seconda della classe di LPS:"),
  );
  tabN("Distanze tipiche tra le calate e tra i conduttori ad anello (CEI EN IEC 62305-3:2024, Tab. 5)", ["Classe di LPS", "I", "II", "III", "IV"], [["Distanza tipica (m)", ...LIVELLI.map((l) => String((distanzaCalate as unknown as Record<string, { distanzaTipica: number }>)[l]?.distanzaTipica ?? "—"))]], [5, 1.5, 1.5, 1.5, 1.5], col);
  B.push(
    p("La disposizione delle calate deve essere tale che:"),
    el("gli impianti di protezione ad aste abbiano almeno una calata in corrispondenza di ogni asta;", "gli impianti di protezione a funi abbiano almeno una calata in corrispondenza di entrambe le estremità di ogni fune;", `gli impianti di protezione a maglia abbiano calate periferiche, con un minimo di 2, disposte con il passo della tabella precedente (${dist} m per LPL ${lpl}) misurato lungo il perimetro.`),
    p("Le calate devono essere interconnesse fra loro mediante conduttori ad anello, preferibilmente chiusi, alla base della struttura e a intervalli in altezza indicativamente pari alla distanza tipica della tabella precedente."),
    p("Le calate devono, per quanto possibile, essere disposte in prosecuzione diretta degli organi di captazione e, per impianti di protezione a maglia, in corrispondenza di nodi, vicino agli spigoli ed equidistanti fra loro."),
    p("Le calate devono essere collocate possibilmente distanti da porte e finestre ed essere disposte il più possibile lungo percorsi rettilinei. Ogni calata deve avere un punto di sezionamento per le misure, salvo che si utilizzino calate naturali."),
    p("Nei punti di incrocio con le calate, i pluviali in metallo devono essere collegati con le calate. I pluviali in metallo, anche se non utilizzati come calate, sono da collegare alla base con il sistema equipotenziale oppure con l'impianto di terra."),
  );
  const rame = SEZIONI_EQUIPOTENZIALI.rame;
  B.push(h2("7.3 Materiali e dimensioni minime per organi di captazione e di calata"),
    p("I materiali, le configurazioni, le minime sezioni dei conduttori e delle aste dei captatori sono definiti dalla Tabella 7 della norma CEI EN IEC 62305-3:2024, di cui si riportano i valori principali:"),
  );
  tabN("Materiale, configurazione e sezione minima di captatori, aste e calate (CEI EN IEC 62305-3:2024, Tab. 7)", ["Materiale", "Configurazione", "Sezione minima (mm²)"], SEZIONI_CAPTATORI_CALATE.filter((z) => ["rame", "alluminio", "acciaio-zincato", "acciaio-inox"].includes(z.materiale)).map((z) => [NOMI_MATERIALI[z.materiale], NOMI_CONFIGURAZIONI[z.configurazione], String(z.sezione)]), [4, 5, 2]);
  B.push(
    p([{ t: "Verranno utilizzati per gli organi di captazione e di calata conduttori tondi in alluminio o in acciaio zincato a caldo da 50 mm² (diametro 8 mm)" }, ...(() => { const m = [...new Set(x.conduttori.filter((c) => c.tipo !== "terra").map((c) => [c.materiale, c.sezione ? `${c.sezione}${/^\d+$/.test(c.sezione) ? " mm²" : ""}` : ""].filter(Boolean).join(" ")).filter(Boolean))]; return m.length ? [{ t: `; nel progetto: ${m.join(", ")}` }] : []; })(), { t: "." }]),
    p("Questi requisiti risultano dalla conduttività elettrica dei materiali utilizzati per condurre la corrente di fulmine (aumento di temperatura) e dalle sollecitazioni meccaniche durante l'utilizzo."),
    p("Quando si utilizza un tondino Ø 8 mm come punta di captazione, è ammessa un'altezza libera massima di 0,5 m. La limitazione dell'altezza per il tondino Ø 10 mm è di 1 m di lunghezza libera."),
  );
  tabN("Sezione minima dei conduttori equipotenziali (CEI EN IEC 62305-3:2024, Tab. 9 e 10)", ["Materiale", "Tra le barre equipotenziali o verso terra (mm²)", "Verso le masse metalliche interne (mm²)"], (["rame", "alluminio", "acciaio"] as const).map((m) => [m.charAt(0).toUpperCase() + m.slice(1), String(SEZIONI_EQUIPOTENZIALI[m].traBarre), String(SEZIONI_EQUIPOTENZIALI[m].corpiInterni)]), [3, 5, 5]);
  B.push(
    p(`Secondo le Tabelle 9 e 10 della norma CEI EN IEC 62305-3:2024, la sezione minima richiesta per un conduttore di collegamento tra barre equipotenziali, o verso l'impianto di terra, è ${rame.traBarre} mm² in rame (${SEZIONI_EQUIPOTENZIALI.alluminio.traBarre} mm² in alluminio, ${SEZIONI_EQUIPOTENZIALI.acciaio.traBarre} mm² in acciaio); verso le masse metalliche interne è ${rame.corpiInterni} mm² in rame. Sarebbe quindi possibile utilizzare un cavo in rame isolato in PVC NYY 1 × 16 mm², provato con corrente impulsiva di 100 kA (10/350 µs), come calata oppure come conduttore fuori terra e interrato.`),
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
    el("CEI EN IEC 62305-1:2024 – \"Protezione contro i fulmini. Parte 1: Principi generali\";", "CEI EN IEC 62305-2:2024 – \"Protezione contro i fulmini. Parte 2: Valutazione del rischio\";", "CEI EN IEC 62305-3:2024 – \"Protezione contro i fulmini. Parte 3: Danno materiale alle strutture e pericolo per le persone\";", "CEI EN IEC 62305-4:2024 – \"Protezione contro i fulmini. Parte 4: Impianti elettrici ed elettronici nelle strutture\";", "CEI 81-29 – \"Linee guida per l'applicazione delle norme CEI EN 62305\";", "CEI EN IEC 62858 – \"Densità di fulminazione. Reti di localizzazione fulmini (LLS) – Principi generali\"."),
  );

  // densità
  const k = x.rischio?.struttura.k ?? 2;
  B.push(h1("10. Densità annua di fulmini a terra"),
    p("La densità annua di fulmini a terra al kilometro quadrato nella posizione in cui è ubicata la struttura vale:"),
    p([{ t: `NG = ${it(d.densita)}  –  NSG = ${it(k * d.densita)}`, b: true, i: true }, { t: "  fulmini/(anno·km²)", i: true }], { allinea: "centro" }),
    p([{ t: `NSG è la densità dei punti di impatto al suolo; se il fornitore dei dati non indica il rapporto k = NSG/NG si assume k = 2 (CEI EN IEC 62305-2:2024, A.1). Nel progetto k = ${it(k)}. I valori sono quelli dell'attestato allegato (capitolo 17). ` }, dc("verificare NG e NSG con l'attestato")]),
  );

  // struttura
  const pos = fattori.find((f) => f.id === d.posizioneId);
  B.push(h1("11. Individuazione della struttura da proteggere"),
    p([{ t: "La struttura che si vuole proteggere coincide con " }, ...(titolo ? [{ t: `«${titolo}»` }] : [dc("edifici da proteggere")]), { t: ", rappresentata nei disegni allegati." }]),
    p("La struttura e le sue zone sono state definite tenuto conto di:"),
    el("compartimenti antincendio esistenti e/o che sarebbe opportuno realizzare;", "eventuali locali già protetti (e/o che sarebbe opportuno proteggere specificamente) contro il LEMP (impulso elettromagnetico);", "i tipi di superficie del suolo all'esterno della struttura, i tipi di pavimentazione interni ad essa e l'eventuale presenza di persone;", "le altre caratteristiche della struttura e, in particolare, il lay-out degli impianti interni e le misure di protezione esistenti."),
    p("Pertanto, ai sensi dell'Allegato A della norma CEI EN IEC 62305-2:2024, le dimensioni e le caratteristiche della struttura da considerare sono quelle dell'edificio stesso:"),
    tab(["Dato", "Valore"], [
      ["Ubicazione", [[d.comune, r.provincia ? `(${r.provincia})` : ""].filter(Boolean).join(" "), d.indirizzo ?? ""].filter(Boolean).join(", ") || "—"],
      ...(typeof d.lat === "number" && typeof d.lon === "number" ? [["Coordinate (WGS84)", `${d.lat.toFixed(6).replace(".", ",")}° N, ${d.lon.toFixed(6).replace(".", ",")}° E`] as Testo[]] : []),
      ["Destinazione d'uso", destinazione],
      ["Dimensioni di ingombro L × W × H", d.L > 0 ? `${it(d.L)} × ${it(d.W)} × ${it(d.H)} m` : [dc("dimensioni")]],
      ["Copertura", d.copertura], ["Struttura", d.materiale], ["Impianti in copertura", d.impiantiTetto ? "Sì" : "No"],
      ["Posizione relativa (CD)", pos ? `${pos.descrizione} (CD = ${it(pos.valore)})` : "—"],
    ], [4, 8]),
  );
  tabN("Fattore di posizione CD (CEI EN IEC 62305-2:2024, Tab. A.1) – riga del progetto evidenziata", ["Posizione relativa della struttura", "CD"], fattori.map((f) => [f.descrizione, it(f.valore)]), [9, 2]);
  { const b = B.pop()!; B.push(evid(b, [fattori.findIndex((f) => f.id === d.posizioneId)])); }
  corpi.forEach((c, i) => {
    const xs = c.impronta.map((q) => q[0]), ys = c.impronta.map((q) => q[1]);
    const a = Math.max(...xs) - Math.min(...xs), b = Math.max(...ys) - Math.min(...ys);
    B.push(h3(c.nome || `Edificio ${i + 1}`), p(`${c.nome || `L'edificio ${i + 1}`} ha dimensioni planari di ${it(Math.max(a, b), 1)} m × ${it(Math.min(a, b), 1)} m (${c.impronta.length === 4 ? "pianta rettangolare" : `pianta di ${c.impronta.length} lati`}), un'area di ${it(areaPoligono(c.impronta), 0)} m², un perimetro di ${it(perimetro(c.impronta), 1)} m e un'altezza di gronda di ${it(c.quotaBase + c.altezzaGronda, 2)} m${c.tipoTetto === "falde" ? `, con copertura a falde e colmo a ${it(c.quotaBase + c.altezzaColmo, 2)} m` : c.tipoTetto === "piano" ? ", con copertura piana" : ""}.`));
  });
  const fotoBlocchi = () => { for (const f of im.foto ?? []) { B.push(bloccoImmagine(f.img, 15, "centro", 11)); B.push(p([{ t: `Figura ${++nFig} – `, b: true }, { t: f.didascalia || "Immagine del sopralluogo" }], { allinea: "centro", dimensione: 9 })); } };
  B.push(p(r.descrizione ? r.descrizione : [dc("esito del sopralluogo: impianti e calate esistenti, componenti naturali (ferri d'armatura, parapetti, putrelle, strutture metalliche), collegamenti verificati, impianti in copertura con le loro altezze, fotografie")]));
  if (im.foto?.length) fotoBlocchi(); else B.push(p([dc("fotografie del sopralluogo e planimetria (si possono aggiungere in \"Dati della relazione\")")]));

  // dati iniziali e rischio
  B.push(h1("12. Dati iniziali e valutazione del rischio"),
    p([{ t: "La destinazione d'uso prevalente della struttura è: " }, ...destinazione, { t: "." }]),
    p("In relazione anche alla sua destinazione d'uso, la struttura può essere soggetta a:"),
    el("perdita di vite umane (L1);", "perdita per danno materiale (L2);", "guasto degli impianti interni (frequenza del danno F)."),
    p("In accordo con la norma CEI EN IEC 62305-2:2024, per valutare la necessità della protezione contro il fulmine devono pertanto essere calcolati il rischio R = RL1 + RL2 e la frequenza del danno F per ogni zona della struttura."),
    p("Le valutazioni di natura economica, volte ad accertare la convenienza dell'adozione delle misure di protezione, non sono state condotte perché non richieste dal Committente."),
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
    tabN("Categorie di perdita e perdite tipiche LF, LO (CEI EN IEC 62305-2:2024, Tab. C.2)", ["Categoria della struttura", "LF", "LO"], CATEGORIE.map((c) => [c.nome, sci(c.LF), sci(c.LO)]), [8, 1.6, 1.6]);
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
    const righeEsito = (es: EsitoStruttura): Testo[][] => es.zone.map((z) => [z.zona.nome, sci(z.RL1), sci(z.RL2), [...sci(z.R), { t: z.conforme ? "  ≤ RT" : "  > RT", b: true }], sci(z.F), [...sci(z.FT), { t: z.frequenzaConforme ? "  F ≤ FT" : "  F > FT", b: true }]]);
    const comp = (es: EsitoStruttura) => tab(["Zona", "RA", "RB", "RC", "RM", "RU", "RV", "RW", "RZ"], es.zone.map((z) => [z.zona.nome, sci(z.componenti.RA + z.componenti.RAD), sci(z.componenti.RB), sci(z.componenti.RC), sci(z.componenti.RM), sci(z.componenti.RU), sci(z.componenti.RV), sci(z.componenti.RW), sci(z.componenti.RZ)]), [1.6, 1, 1, 1, 1, 1, 1, 1, 1]);
    B.push(h2("12.2 Rischio della struttura senza misure di protezione"), tab(["Zona", "RL1", "RL2", "R", "F", "FT"], righeEsito(esitoSenza), [2.4, 1.6, 1.6, 2.2, 1.6, 2.2]), h3("Componenti di rischio"), comp(esitoSenza),
      h2(`12.3 Rischio della struttura con le misure di progetto (LPS e SPD di livello ${lpl})`), tab(["Zona", "RL1", "RL2", "R", "F", "FT"], righeEsito(esitoCon), [2.4, 1.6, 1.6, 2.2, 1.6, 2.2]), h3("Componenti di rischio"), comp(esitoCon));
    B.push(h3("Confronto grafico"));
    fig(barreLog({ categorie: esitoSenza.zone.map((z) => z.zona.nome), serie: [{ nome: "senza protezione", valori: esitoSenza.zone.map((z) => z.R) }, { nome: `con LPS e SPD di livello ${lpl}`, valori: esitoCon.zone.map((z) => z.R) }], soglia: { valore: RT, etichetta: "RT = 10⁻⁵" }, asseY: "rischio R (1/anno)" }), "Rischio R di ogni zona senza e con le misure di protezione, confrontato con RT (scala logaritmica)");
    const peggiore = esitoSenza.zone.reduce((a, z, i) => (z.R > (esitoSenza!.zone[a]?.R ?? 0) ? i : a), 0);
    const zs = esitoSenza.zone[peggiore]!, zc = esitoCon.zone[peggiore]!;
    const NOMI_C = ["RA", "RB", "RC", "RM", "RU", "RV", "RW", "RZ"] as const;
    const val = (z: typeof zs) => NOMI_C.map((k) => (k === "RA" ? z.componenti.RA + z.componenti.RAD : z.componenti[k]));
    fig(barreLog({ categorie: [...NOMI_C], serie: [{ nome: "senza protezione", valori: val(zs) }, { nome: `con LPS e SPD di livello ${lpl}`, valori: val(zc) }], soglia: { valore: RT, etichetta: "RT = 10⁻⁵" }, asseY: "componente di rischio (1/anno)" }), `Componenti di rischio della zona «${zs.zona.nome}» senza e con le misure di protezione (scala logaritmica)`);
    fig(barreLog({ categorie: esitoSenza.zone.map((z) => z.zona.nome), serie: [{ nome: "F senza protezione", valori: esitoSenza.zone.map((z) => z.F) }, { nome: `F con SPD di livello ${lpl}`, valori: esitoCon.zone.map((z) => z.F) }], soglia: { valore: Math.min(...esitoCon.zone.map((z) => z.FT)), etichetta: `FT = ${it(Math.min(...esitoCon.zone.map((z) => z.FT)), 2)}` }, asseY: "frequenza del danno F (1/anno)" }), "Frequenza del danno agli impianti interni F di ogni zona, confrontata con FT (scala logaritmica)");
    const caso = esitoSenza.conforme && esitoSenza.frequenzaConforme ? 1 : esitoCon.conforme && esitoCon.frequenzaConforme ? 2 : 3;
    B.push(h2("12.4 Esito"),
      p([{ t: caso === 1 ? "Caso 1 – la struttura è autoprotetta: non sono necessarie misure di protezione." : caso === 2 ? `Caso 2 – con un LPS di classe ${lpl} e un sistema di SPD di livello ${lpl} la struttura è protetta.` : `Caso 3 – con le misure di livello ${lpl} la struttura NON risulta protetta: servono ulteriori misure.`, b: true }]),
      p(minimo ? `La protezione minima che rende R ≤ RT in tutte le zone è: ${nomeProtezione(minimo)}.${minimo !== "nessuno" && LIVELLI.indexOf(minimo as Lpl) < LIVELLI.indexOf(lpl) ? " Il livello di progetto è inferiore a quello minimo e va rivisto." : ""}` : "Nessuna combinazione di LPS e SPD dello stesso livello porta R ≤ RT: servono altre misure (antincendio, schermature, misure contro le tensioni di contatto e di passo)."),
      ...(!esitoCon.frequenzaConforme ? [p("La frequenza del danno F supera FT: vanno previste misure SPM (sistema coordinato di SPD, schermature, percorsi dei cavi) secondo la CEI EN IEC 62305-4:2024.")] : []),
    );
  } else {
    B.push(p([{ t: x.risultati.rischio ? `Livello di protezione da valutazione: ${x.risultati.rischio.lpl} (${x.risultati.rischio.esito}). ` : "" }, dc(`valutazione del rischio non compilata nell'app (pagina Rischio). Livello di progetto dichiarato: LPL ${lpl}`)]));
  }

  // ---------- 13 soluzione di progetto
  const capt = x.conduttori.filter((c) => c.tipo === "captazione"), lCapt = capt.reduce((a, c) => a + lunghezza(c), 0);
  const calate = x.conduttori.filter((c) => c.tipo === "calata");
  const nCalate = calate.length || x.risultati.calate?.numero || 0;
  const per = corpi.reduce((t, c) => t + perimetro(c.impronta), 0) || (d.L > 0 && d.W > 0 ? 2 * (d.L + d.W) : 0);
  const asteGr = new Map<string, { altezza: number; codice: string; n: number }>();
  for (const a of x.aste) { const kk = `${a.altezza.toFixed(2)}|${a.codiceOBO}`; const g = asteGr.get(kk); if (g) g.n++; else asteGr.set(kk, { altezza: a.altezza, codice: a.codiceOBO, n: 1 }); }
  // distanza massima tra un'asta e la più vicina (in pianta)
  let dMax = 0;
  for (const a of x.aste) { let m = Infinity; for (const b of x.aste) if (b !== a) m = Math.min(m, Math.hypot(a.x - b.x, a.y - b.y)); if (Number.isFinite(m)) dMax = Math.max(dMax, m); }
  const ver = x.risultati.captazione?.verifica;
  B.push(h1("13. Scelta delle misure di protezione e soluzione di progetto"),
    p(`Da progetto, l'analisi di rischio definita per la struttura è di livello ${lpl}. Pertanto, viene previsto un LPS di classe ${lpl} coordinato con il sistema dei dispersori e con il sistema di SPD.`),
    h2("13.1 Sistema di captazione"),
    p(x.risultati.captazione?.descrizione ? x.risultati.captazione.descrizione : [dc("descrizione della soluzione di captazione (aste su putrelle/ringhiera, aste isolate su treppiede, maglia)")]),
  );
  if (asteGr.size || capt.length) {
    B.push(p("Così progettato l'impianto di captazione sarà costituito da:"), el(
      ...[...asteGr.values()].sort((a, b) => a.altezza - b.altezza).map((g): Testo => `N° ${g.n} – aste di altezza ${it(g.altezza)} m${g.codice ? ` (art. ${g.codice})` : ""}`),
      ...(capt.length ? [`conduttori di captazione per ${it(lCapt, 1)} m complessivi (${capt.length} ${capt.length === 1 ? "tratto" : "tratti"})` as Testo] : []),
      ...(x.risultati.captazione ? [`N° ${x.risultati.captazione.giunzioni} giunzioni e N° ${x.risultati.captazione.incroci} incroci` as Testo] : []),
    ));
  }
  B.push(p(`Con un LPS di classe ${lpl} la sfera rotolante di riferimento ha raggio ${R} m. La profondità di penetrazione della sfera tra due captatori in funzione della loro distanza (diagonale della figura replicata) è:`),
    tab(["Distanza tra i captatori d (m)", ...[10, 15, 20, 25, 30, 35, 40].map(String)], [["Penetrazione p (m)", ...[10, 15, 20, 25, 30, 35, 40].map((dd) => it(penetrazione(R, dd), 2))]], [3.5, 1, 1, 1, 1, 1, 1, 1]),
  );
  fig(graficoSfera(R, dMax > 0 ? dMax : null), `Profondità di penetrazione della sfera rotolante (R = ${R} m) in funzione della distanza tra i captatori e schema in sezione`);
  B.push(
    ...(dMax > 0 ? [p(`Nel progetto la distanza massima tra un'asta e la più vicina è di ${it(dMax, 1)} m: la sfera penetra di circa ${it(penetrazione(R, dMax), 2)} m (lungo la diagonale tra quattro aste la penetrazione è maggiore e va verificata sui disegni).`)] : []),
    p([{ t: "Sul tetto dell'edificio viene mantenuta un'altezza da difendere di: " }, dc("altezze massime degli impianti da proteggere per ogni zona della copertura"), { t: ". Sarà prevista una distanza di sicurezza di almeno 1 m tra l'altezza massima da proteggere e il punto di massima penetrazione della sfera rotolante." }]),
  );
  if (ver) B.push(tab(["Verifica della captazione", "Valore"], [["Superficie protetta dalla sfera rotolante", `${it(ver.areaProtettaSfera, 1)} m²`], ["Superficie protetta dalla maglia", `${it(ver.areaProtettaMaglia, 1)} m²`], ["Superficie esposta", `${it(ver.areaEsposta, 1)} m²`], ["Maglie conformi", `${ver.maglie.filter((m) => m.conforme).length} su ${ver.maglie.length}`]], [6, 5]), ...(ver.areaEsposta > 0.5 ? [p([{ t: `Attenzione: ${it(ver.areaEsposta, 1)} m² di copertura risultano esposti. `, b: true }, dc("integrare la captazione o motivare")])] : []));
  B.push(p([{ t: "Aste su treppiede: in funzione della valutazione del carico di vento è necessario scegliere il numero di blocchi in calcestruzzo per sostenere l'asta. Nelle tabelle seguenti è possibile incrociare la velocità del vento con l'altezza dell'asta scelta: la velocità indicata è quella massima ammessa con il numero di blocchi della riga. Va inoltre considerato il peso della struttura che sostiene l'asta (asta, treppiede, blocchi). " }, dc("velocità del vento di progetto, numero di blocchi e pesi")]));
  for (const tb of blocchiTreppiede.tabelle) {
    const cols = tb.colonne as { altezza: number; materiale?: string; asta: string; sostegno: string; vento: number[] }[];
    const art = (c: string) => `${c.slice(0, 4)} ${c.slice(4)}`;
    tabN(`Numero di blocchi in calcestruzzo da 16 kg – ${tb.titolo} (catalogo OBO)`, ["Altezza asta (m)", ...cols.map((c) => it(c.altezza, 1) + (c.materiale ? ` ${c.materiale}` : "")), "Blocchi"], [
      ["Asta – Art. n.", ...cols.map((c) => art(c.asta)), ""],
      ["Treppiede – Art. n.", ...cols.map((c) => art(c.sostegno)), ""],
      ...blocchiTreppiede.blocchi.map((bl, i) => [i === 0 ? "Velocità del vento (km/h)" : "", ...cols.map((c) => String(c.vento[i] ?? "")), [{ t: bl, b: true }]] as Testo[]),
    ], [2.6, ...cols.map(() => 1), 1.6]);
    { const b = B.pop()!; B.push(b.tipo === "tabella" ? { ...b, dimensione: cols.length > 5 ? 7.5 : 8.5 } : b); }
  }
  B.push(
  );
  fig(piantaCopertura(corpi, x.conduttori, x.aste), "Pianta schematica della copertura con captatori, conduttori e calate (dal modello di progetto; il disegno esecutivo è nelle tavole allegate)");
  B.push(
    p("I captatori saranno collegati al sistema disperdente attraverso un insieme di calate posizionate lungo il perimetro dell'edificio. Le aste sono posizionate nelle vicinanze delle calate per ridurre al minimo le correnti vaganti sul tetto dell'edificio ed evitare quindi accoppiamenti elettrici indesiderati. Nelle planimetrie allegate è possibile individuare la posizione esatta di tutto il sistema dei captatori; i tipologici del capitolo 14 dettagliano i collegamenti."));
  B.push(h2("13.2 Calate"));
  if (nCalate) {
    B.push(tab(["Elemento", "Valore"], [
      ["Numero di calate", String(nCalate)], ["Perimetro della struttura", `${it(per, 1)} m`],
      ["Distanza media tra le calate", per > 0 ? `${it(per / nCalate, 1)} m` : "—"], [`Distanza tipica (LPL ${lpl}, Tab. 5)`, `${dist} m`],
      ...(calate.length ? [["Lunghezza totale delle calate", `${it(calate.reduce((a, c) => a + lunghezza(c), 0), 1)} m`] as Testo[]] : x.risultati.calate ? [["Lunghezza conduttori di calata", `${it(x.risultati.calate.lunghezzaConduttori, 1)} m`] as Testo[]] : []),
    ], [5, 7]));
    if (per > 0 && per / nCalate > dist * 1.001) B.push(p([{ t: "La distanza media supera quella tipica: ", b: true }, dc("aumentare le calate o motivare (componenti naturali, calate esistenti nella struttura)")]));
  } else B.push(p([dc("numero e posizione delle calate (esistenti o di progetto)")]));
  // separazione
  const ki = x.separazione.ki ?? KI[lpl], kc = kcSemplificato(Math.max(1, nCalate || 1));
  const km = { ...KM, ...(x.separazione.kmSolido ? { solido: x.separazione.kmSolido } : {}) };
  const esiti = verificaPunti(x.separazione.punti, ki, kc, km);
  B.push(h2("13.3 Distanza di separazione"),
    p("Tra l'LPS e le parti metalliche o gli impianti interni deve essere rispettata la distanza di separazione s, calcolata con il metodo semplificato della CEI EN IEC 62305-3:2024:"),
    p([{ t: "s = (k" }, { t: "i", sub: true }, { t: " × k" }, { t: "c", sub: true }, { t: " / k" }, { t: "m", sub: true }, { t: ") × l" }], { formula: true }),
    p(`con ki = ${it(ki, 3)} (LPL ${lpl}), kc = ${it(kc, 3)} (${nCalate || 1} calate), km = 1 in aria e ${it(km.solido, 2)} in materiale solido; l è la lunghezza lungo l'LPS dal punto considerato al più vicino collegamento equipotenziale.`),
  );
  tabN("Coefficiente ki in funzione della classe di LPS (CEI EN IEC 62305-3:2024, Tab. 11)", ["Classe di LPS", "I", "II", "III", "IV"], [["ki", ...LIVELLI.map((l) => it(KI[l], 2))]], [5, 1.5, 1.5, 1.5, 1.5], col);
  tabN("Coefficiente km in funzione del materiale isolante (CEI EN IEC 62305-3:2024, Tab. 12)", ["Materiale", "km"], (Object.keys(KM) as (keyof typeof KM)[]).map((m) => [NOMI_MATERIALE[m], it(km[m], 2)]), [9, 2]);
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
  } else B.push(p([dc("impianto di terra esistente o di progetto (tipo, anelli, collegamenti, misure di resistenza)")]));
  { const rhos = [100, 500, 1000, 1500, 2000, 2500, 3000];
    tabN("Lunghezza minima l1 del dispersore in funzione della resistività del terreno (CEI EN IEC 62305-3:2024, 5.4.2)", ["Resistività ρ (Ωm)", ...rhos.map(String)], LIVELLI.map((l) => [`Classe ${l} (m)`, ...rhos.map((rho) => it(l1Norma(l, rho), 1))]), [3, 1, 1, 1, 1, 1, 1, 1]);
    const b = B.pop()!; B.push(evid(b, [LIVELLI.indexOf(lpl)])); }
  tabN("Dimensioni minime dei dispersori (CEI EN IEC 62305-3:2024, Tab. 8)", ["Materiale", "Configurazione", "Diametro (mm)", "Sezione (mm²)", "Piastra (mm)"], DIMENSIONI_DISPERSORI.map((z) => [NOMI_MATERIALI[z.materiale], NOMI_CONFIGURAZIONI[z.configurazione], z.diametro != null ? String(z.diametro) : "—", z.sezione != null ? String(z.sezione) : "—", z.piastra ?? "—"]), [3, 3, 1.4, 1.4, 3]);
  // SPD
  B.push(h2("13.5 Protezione degli impianti interni (SPD)"),
    p("Le linee metalliche entranti (energia, telecomunicazioni, dati) sono collegate all'impianto equipotenziale all'ingresso nella struttura, direttamente o tramite SPD, per evitare scariche pericolose e proteggere gli impianti interni secondo la CEI EN IEC 62305-4:2024."));
  if (x.risultati.spd?.dispositivi.length) B.push(p(x.risultati.spd.descrizione), tab(["Art. No", "Descrizione", "Quantità"], x.risultati.spd.dispositivi.map((s) => [s.codice, s.descrizione, String(s.quantita)]), [2, 8, 1.5]));
  else B.push(p([dc(`SPD previsti per le linee entranti (livello ${lpl}) o SPD esistenti`)]));

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
      if (pa.immagine) B.push({ tipo: "immagine", svg: "", pdf: pa.immagine, larghezza: 16, altezza: 11, mancante: `scheda ${pa.immagine} non trovata nell'archivio dei particolari: inserire il disegno del tipologico` });
      B.push(p([{ t: `Figura ${++nFig} – `, b: true }, ...(pa.immagine ? [{ t: `Tipologico ${n}: ${pa.nome ?? pa.id} (scheda OBO ${pa.id})` }] : [dc(`disegno del tipologico ${pa.id} (scheda OBO)`)])], { dimensione: 9 }));
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
    p("Al termine dei lavori l'installatore rilascia la dichiarazione di conformità ai sensi del D.M. 37/2008. L'impianto è soggetto alla denuncia e alle verifiche periodiche previste dal D.P.R. 462/2001. L'LPS deve essere esaminato a vista periodicamente e verificato in modo completo secondo il piano di manutenzione della CEI EN IEC 62305-3:2024, e comunque dopo ogni fulminazione accertata o modifica della struttura."));

  // ---------- 17 NG-NSG
  B.push(h1("17. Valori NG – NSG (CEI EN IEC 62305 – CEI EN IEC 62858)"),
    tab(["", ""], [
      [[...pedice("N", "G")], `${it(d.densita)} fulmini/(anno·km²)`],
      [[...pedice("N", "SG")], `${it(k * d.densita)} punti/(anno·km²)`],
      ["Latitudine", typeof d.lat === "number" ? `${d.lat.toFixed(6).replace(".", ",")}° N` : [dc("latitudine")]],
      ["Longitudine", typeof d.lon === "number" ? `${d.lon.toFixed(6).replace(".", ",")}° E` : [dc("longitudine")]],
    ], [4, 8]),
    p("I valori di NG (numero medio di fulmini a terra all'anno e al kilometro quadrato) e NSG (numero medio dei punti di impatto a terra all'anno e al kilometro quadrato) sono riferiti alle coordinate geografiche della struttura (WGS84) e sono riportati nell'attestato rilasciato dal fornitore dei dati secondo la CEI EN IEC 62858, allegato in originale alla presente relazione con le sue condizioni d'uso e la sua validità temporale."),
    p([{ t: "Attestato: " }, dc("fornitore, numero e data dell'attestato NG/NSG")]),
  );

  B.push(h1("18. Allegati"), el("Attestato dei valori NG e NSG (CEI EN IEC 62858)", "Disegni di posizionamento del sistema di captazione e delle calate (DWG/DXF)", "Schede dei particolari costruttivi OBO", "Elenco materiale (Excel)"),
    p("Calcoli di supporto alla progettazione eseguiti con OBO Hub · Progettazione LPS (CEI EN IEC 62305:2024). Il documento va verificato, completato nelle parti evidenziate e firmato da un tecnico abilitato.", { dimensione: 9, spazioPrima: 12 }),
    p([{ t: `${r.luogo || "Rivoli"}, ${dataLunga(x.data)}` }], { spazioPrima: 18 }),
    p([{ t: "Il tecnico  " }, dc("nome, albo e firma")], { allinea: "destra", spazioPrima: 12 }),
  );

  return {
    titolo: `Relazione LPS – ${titolo || d.comune || "progetto"}`,
    intestazione: `${titolo || "Relazione tecnica LPS"}${d.comune ? ` – ${d.comune}` : ""} · Relazione impianto di protezione dalle scariche atmosferiche${rev ? ` · Rev. ${rev}` : ""}`,
    piede: [
      [{ t: "OBO Bettermann S.r.l.", b: true }, { t: " a socio unico · Via Ferrero 16 – 10098 Cascine Vica Rivoli (TO) · Tel. +39 011 9548 811 · Fax +39 011 9548 899" }],
      "R.E.A. n° 1035379 – Registro Imprese n° 09227890010 Trib. di Torino – Cap. Soc. € 300.000 i.v. – C.Fisc./P.IVA 09227890010",
      "Società soggetta all'attività di direzione e coordinamento di Arvigrat Holding AG",
    ],
    blocchi: B,
  };
}

/** RT usato (per i controlli esterni). */
export const RISCHIO_TOLLERABILE = RT;
