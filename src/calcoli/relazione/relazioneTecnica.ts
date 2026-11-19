/**
 * Relazione tecnica dell'impianto di protezione dalle scariche atmosferiche, sul modello della relazione OBO
 * (format di Marco Lo Vetere, novembre 2025) aggiornato all'edizione 2024 della CEI EN IEC 62305.
 *
 * Testo descrittivo: quello del format OBO, corretto dove l'edizione 2024 cambia le cose (un solo rischio R,
 * frequenza del danno F al posto di R2/R4, EN 50164 sostituita dalla serie EN IEC 62561). Le definizioni sono
 * scritte con parole nostre: nessun testo o figura della norma è copiato, solo valori e riferimenti.
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

export type Lpl = "I" | "II" | "III" | "IV";

/** Dati della relazione che l'app non calcola (salvati nel progetto). */
export interface DatiRelazione {
  committente: string; indirizzoCommittente: string; cittaCommittente: string;
  provincia: string; titoloOpera: string; destinazione: string; luogo: string;
  /** testo libero: sopralluogo, impianti esistenti, scelte del progettista */
  descrizione: string;
}
export const datiRelazioneVuoti: DatiRelazione = { committente: "", indirizzoCommittente: "", cittaCommittente: "", provincia: "", titoloOpera: "", destinazione: "", luogo: "Rivoli", descrizione: "" };

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

/** Componi la relazione tecnica. */
export function relazioneTecnica(x: IngressoRelazione): Documento {
  const d = x.edificio, r = x.dati, B: Blocco[] = [];
  const lpl: Lpl = d.lplProgetto ?? x.lplDisegno;
  const rev = x.revisioni.at(-1)?.rev;
  const titolo = r.titoloOpera || d.nomeProgetto || "";
  const corpi = x.modello.corpi;

  // ================= COPERTINA =================
  B.push(
    p([{ t: "OBO Bettermann S.r.l.", b: true }], { allinea: "destra", dimensione: 11, spazioDopo: 0 }),
    p("Via C. Ferrero 16 · 10098 Rivoli (TO)\nTel. +39 011 9548 811\ntecnico@obo.it · www.obo.it", { allinea: "destra", dimensione: 9 }),
    p("", { spazioPrima: 60 }),
    p(d.comune ? `COMUNE DI ${d.comune.toUpperCase()}` : [dc("comune")], { allinea: "centro", grassetto: true, dimensione: 14, spazioDopo: 2 }),
    p(r.provincia ? `PROVINCIA DI ${r.provincia.toUpperCase()}` : [dc("provincia")], { allinea: "centro", grassetto: true, dimensione: 12, spazioDopo: 30 }),
    p(titolo ? titolo.toUpperCase() : [dc("titolo dell'opera")], { allinea: "centro", grassetto: true, dimensione: 16, spazioDopo: 30 }),
    p("Relazione tecnica impianto di protezione\ndalle scariche atmosferiche", { allinea: "centro", grassetto: true, dimensione: 18, spazioDopo: 10 }),
    p(`CEI EN IEC 62305:2024 · Livello di protezione (LPL) ${lpl}`, { allinea: "centro", dimensione: 11, spazioDopo: 60 }),
    p("Committente", { allinea: "centro", dimensione: 11, spazioDopo: 4 }),
    p(r.committente ? [{ t: r.committente, b: true }] : [dc("committente")], { allinea: "centro", dimensione: 13, spazioDopo: 2 }),
    p([r.indirizzoCommittente || r.cittaCommittente ? { t: [r.indirizzoCommittente, r.cittaCommittente].filter(Boolean).join("\n") } : dc("indirizzo del committente")], { allinea: "centro", spazioDopo: 60 }),
    p(`${r.luogo || "Rivoli"}, ${dataLunga(x.data)}`, { allinea: "centro", dimensione: 11 }),
    p([x.codice ? `Progetto n. ${x.codice}` : "", rev ? `Rev. ${rev}` : "Bozza"].filter(Boolean).join(" · "), { allinea: "centro", dimensione: 9 }),
    { tipo: "salto" },
  );

  // revisioni
  if (x.revisioni.length) {
    B.push(h3("Revisioni del documento"), tab(["Rev.", "Data", "Descrizione", "Autore"], x.revisioni.map((v) => [v.rev, new Date(v.data).toLocaleDateString("it-IT"), v.descrizione, v.autore]), [1, 2, 6, 3]));
  }

  // ================= 1 PREMESSA =================
  const destinazione = r.destinazione ? [{ t: r.destinazione }] : [dc("destinazione d'uso")];
  B.push(h1("1. Premessa"),
    p([{ t: "Scopo del presente documento è la descrizione (ai sensi del D.M. 22 gennaio 2008, n. 37) della realizzazione dell'impianto di protezione dalle scariche atmosferiche per la struttura " }, ...(titolo ? [{ t: `«${titolo}»` }] : [dc("nome della struttura")]), { t: ` ubicata a ${d.comune || "…"}${r.provincia ? ` (${r.provincia})` : ""}${d.indirizzo ? `, ${d.indirizzo}` : ""}, con destinazione d'uso: ` }, ...destinazione, { t: "." }]),
    p("Gli impianti sono stati progettati nell'osservanza delle leggi, dei decreti e delle Norme CEI e UNI indicati nel seguito. Tutti gli impianti dovranno essere realizzati in conformità alle Norme CEI, guide incluse, alle norme UNI e nel rispetto della legislazione vigente alla data di esecuzione delle opere."),
    p("Dovranno essere utilizzati componenti rispondenti alle relative Norme CEI e UNI e alle tabelle di unificazione CEI-UNEL, ove esistano, con marcatura CE e preferibilmente marchio IMQ, e quelli previsti dal D.Lgs. 81/2008 e successive modificazioni. Per i componenti dell'LPS si fa riferimento alla serie CEI EN IEC 62561."),
    p("Le condizioni tecniche del presente documento, integrate con i disegni e i particolari costruttivi allegati, illustrano i criteri di esecuzione e le caratteristiche dei materiali da installare."),
  );

  // ================= 2 ELENCO ELABORATI =================
  B.push(h1("2. Elenco elaborati"), el("Relazione tecnica (il presente documento)", "Particolari costruttivi (tipologici OBO)", "Disegni tecnici di posizionamento (DWG/DXF)", "Elenco materiale"));

  // ================= 3 NORME =================
  B.push(h1("3. Norme e leggi di riferimento"),
    h2("3.1 Leggi e norme generali"),
    el("D.Lgs. 9 aprile 2008, n. 81 – Testo unico sulla salute e sicurezza sul lavoro", "D.M. 22 gennaio 2008, n. 37 – Regolamento sugli impianti negli edifici", "D.P.R. 22 ottobre 2001, n. 462 – Denuncia e verifiche dei dispositivi di protezione contro le scariche atmosferiche e degli impianti di messa a terra", "CEI 64-8 – Impianti elettrici utilizzatori a tensione nominale non superiore a 1000 V in c.a. e 1500 V in c.c.", "CEI 64-12 – Guida per l'esecuzione dell'impianto di terra negli edifici per uso residenziale e terziario", "CEI 11-1 – Impianti elettrici con tensione superiore a 1 kV in c.a.", "CEI EN 50522 – Messa a terra degli impianti elettrici a tensione superiore a 1 kV in c.a."),
    h2("3.2 Verifiche e prove"),
    el("CEI 64-8/6 – Verifiche", "CEI 64-14 – Guida alle verifiche degli impianti elettrici utilizzatori", "CEI 11-27 – Lavori su impianti elettrici"),
    h2("3.3 Protezione contro i fulmini"),
    el("CEI EN IEC 62305-1:2024 – Protezione contro i fulmini. Parte 1: Principi generali",
      "CEI EN IEC 62305-2:2024 – Parte 2: Valutazione del rischio",
      "CEI EN IEC 62305-3:2024 – Parte 3: Danno materiale alle strutture e pericolo per le persone",
      "CEI EN IEC 62305-4:2024 – Parte 4: Impianti elettrici ed elettronici nelle strutture",
      "CEI EN IEC 62561 (serie, parti 1–8) – Componenti dei sistemi di protezione contro i fulmini (LPSC); sostituisce la serie EN 50164",
      "CEI EN IEC 62858 – Densità di fulminazione. Reti di localizzazione fulmini (LLS)",
      "CEI 81-29 – Linee guida per l'applicazione delle norme CEI EN 62305"),
    p("Le norme dell'edizione 2024 sostituiscono quelle del 2013 (CEI EN 62305-1/2/3/4, CEI 81-10). I valori riportati nel documento sono quelli dell'edizione 2024.", { dimensione: 9 }),
  );

  // ================= 4 DESCRIZIONE =================
  const pos = fattori.find((f) => f.id === d.posizioneId);
  B.push(h1("4. Descrizione dell'intervento"),
    p("Il presente progetto prevede la progettazione e la realizzazione di un sistema di protezione contro la fulminazione diretta (LPS esterno) della struttura, coordinato con l'impianto di terra e con le misure di protezione degli impianti interni (SPD)."),
    h2("4.1 Individuazione della struttura da proteggere"),
  );
  const righeStr: Testo[][] = [
    ["Ubicazione", [[d.comune, r.provincia ? `(${r.provincia})` : ""].filter(Boolean).join(" "), d.indirizzo ?? ""].filter(Boolean).join(", ") || "—"],
    ...(typeof d.lat === "number" && typeof d.lon === "number" ? [["Coordinate (WGS84)", `${d.lat.toFixed(6).replace(".", ",")}° N, ${d.lon.toFixed(6).replace(".", ",")}° E`] as Testo[]] : []),
    ["Destinazione d'uso", destinazione],
    ["Dimensioni di ingombro L × W × H", d.L > 0 ? `${it(d.L)} × ${it(d.W)} × ${it(d.H)} m` : [dc("dimensioni")]],
    ["Copertura", d.copertura],
    ["Struttura", d.materiale],
    ["Impianti in copertura", d.impiantiTetto ? "Sì" : "No"],
    ["Posizione relativa (CD)", pos ? `${pos.descrizione} (CD = ${it(pos.valore)})` : "—"],
  ];
  B.push(tab(["Dato", "Valore"], righeStr, [4, 8]));
  if (corpi.length) {
    B.push(p(`La struttura è descritta nel modello di progetto con ${corpi.length} ${corpi.length === 1 ? "corpo" : "corpi"} di fabbrica:`),
      tab(["Corpo", "Dimensioni in pianta", "Area (m²)", "Perimetro (m)", "Altezza gronda (m)", "Copertura"], corpi.map((c) => {
        const xs = c.impronta.map((q) => q[0]), ys = c.impronta.map((q) => q[1]);
        return [c.nome || c.id, `${it(Math.max(...xs) - Math.min(...xs), 1)} × ${it(Math.max(...ys) - Math.min(...ys), 1)} m`, it(areaPoligono(c.impronta), 0), it(perimetro(c.impronta), 1), it(c.quotaBase + c.altezzaGronda, 2), c.tipoTetto === "piano" ? "piana" : c.tipoTetto === "falde" ? `a falde (colmo ${it(c.quotaBase + c.altezzaColmo, 2)} m)` : "altro"];
      }), [3, 3, 2, 2, 2, 3]));
  }
  B.push(p(r.descrizione ? r.descrizione : [dc("descrizione del sopralluogo: impianti e calate esistenti, componenti naturali (ferri d'armatura, parapetti, strutture metalliche), impianti in copertura e altezze da proteggere, fotografie")]));

  // ================= 5 DEFINIZIONI =================
  const def = (t: string, s: string): Testo => [{ t: `${t}: `, b: true }, { t: s }];
  B.push(h1("5. Definizioni"), el(
    def("Fulmine sulla struttura", "fulmine che colpisce direttamente la struttura da proteggere"),
    def("Fulmine in prossimità della struttura", "fulmine che cade abbastanza vicino da indurre sovratensioni pericolose negli impianti della struttura"),
    def("Fulmine sulla linea", "fulmine che colpisce una linea (energia, telecomunicazioni) entrante nella struttura"),
    def("Fulmine in prossimità della linea", "fulmine che cade vicino a una linea entrante e vi induce sovratensioni pericolose"),
    def("LEMP", "insieme degli effetti elettromagnetici della corrente di fulmine (campi e impulsi accoppiati agli impianti)"),
    def("LPL (livello di protezione)", "numero da I a IV legato ai valori di progetto dei parametri della corrente di fulmine; il livello I è il più severo"),
    def("LPS (sistema di protezione contro il fulmine)", "impianto formato da captazione, calate e dispersori, che riduce il danno materiale da fulminazione diretta"),
    def("SPM", "misure di protezione degli impianti elettrici ed elettronici interni contro il LEMP"),
    def("SPD (limitatore di sovratensione)", "dispositivo che limita le sovratensioni e scarica le correnti impulsive"),
    def("ZS (zona della struttura)", "parte della struttura con caratteristiche omogenee, valutata con un unico gruppo di parametri"),
    def("RT e FT", "rischio tollerabile e frequenza tollerabile del danno, con cui si confrontano il rischio R e la frequenza F calcolati"),
  ));

  // ================= 6 RISCHIO =================
  B.push(h1("6. Valutazione del rischio fulminazione"),
    p("La CEI EN IEC 62305-2:2024 specifica la procedura per valutare il rischio dovuto al fulmine e, se necessario, individua le misure di protezione che riducono il rischio a valori non superiori a quello tollerabile."),
    h2("6.1 Sorgenti, danni e perdite"),
    tab(["Sorgente", "Descrizione"], [["S1", "Fulmine sulla struttura"], ["S2", "Fulmine in prossimità della struttura"], ["S3", "Fulmine su una linea entrante"], ["S4", "Fulmine in prossimità di una linea entrante"]], [1, 6]),
    tab(["Danno", "Descrizione"], [["D1", "Danno a esseri viventi per elettrocuzione (tensioni di contatto e di passo)"], ["D2", "Danno materiale (incendio, esplosione, effetti meccanici e chimici)"], ["D3", "Guasto di impianti elettrici ed elettronici (LEMP)"]], [1, 6]),
    tab(["Perdita", "Descrizione"], [["L1", "Perdita di vite umane, compresi danni permanenti"], ["L2", "Perdita per danni materiali alla struttura e al contenuto"]], [1, 6]),
    p("Rispetto all'edizione 2013 la norma 2024 non valuta più i rischi separati R2 (servizio pubblico), R3 (patrimonio culturale) e R4 (perdita economica): si calcola un unico rischio R = RL1 + RL2, confrontato con RT, e la frequenza del danno agli impianti interni F, confrontata con la frequenza tollerabile FT."),
    h2("6.2 Rischio e frequenza tollerabili"),
    el([{ t: "Rischio tollerabile RT = 10" }, { t: "-5", sup: true }, { t: " anni" }, { t: "-1", sup: true }, { t: " (perdita di vite umane e danni materiali)" }],
      [{ t: "Frequenza tollerabile del danno FT = 0,1 anni" }, { t: "-1", sup: true }, { t: " con impianti interni critici, 1 anni" }, { t: "-1", sup: true }, { t: " negli altri casi, salvo valore diverso indicato dal proprietario" }]),
    h2("6.3 Componenti di rischio"),
    p("Ciascuna componente di rischio si calcola con l'equazione generale:"),
    p([...pedice("R", "X"), { t: " = " }, ...pedice("N", "X"), { t: " × " }, ...pedice("P", "X"), { t: " × " }, ...pedice("L", "X")], { formula: true }),
    p([{ t: "dove N" }, { t: "X", sub: true }, { t: " è il numero annuo di eventi pericolosi (Allegato A), P" }, { t: "X", sub: true }, { t: " la probabilità di danno (Allegato B) e L" }, { t: "X", sub: true }, { t: " la perdita conseguente (Allegato C) della CEI EN IEC 62305-2:2024." }]),
    tab(["Sorgente", "Danno", "Componente", "Descrizione"], [
      ["S1", "D1", "RA", "Esseri viventi per tensioni di contatto e di passo fino a 3 m dalla struttura (e persone esposte in copertura)"],
      ["S1", "D2", "RB", "Danno materiale: incendio o esplosione per scariche pericolose nella struttura"],
      ["S1", "D3", "RC", "Guasto degli impianti interni per il LEMP"],
      ["S2", "D3", "RM", "Guasto degli impianti interni per il LEMP (fulmine vicino)"],
      ["S3", "D1", "RU", "Esseri viventi per tensioni di contatto dovute alla corrente entrante dalla linea"],
      ["S3", "D2", "RV", "Danno materiale per scariche all'ingresso della linea"],
      ["S3", "D3", "RW", "Guasto degli impianti interni per sovratensioni trasmesse dalla linea"],
      ["S4", "D3", "RZ", "Guasto degli impianti interni per sovratensioni indotte sulla linea"],
    ], [1.2, 1, 1.4, 7]),
    p("RC, RM, RW e RZ entrano nel rischio per la perdita L1 solo dove il guasto degli impianti interni mette subito in pericolo la vita (ospedali, strutture con rischio di esplosione); per L2 solo con rischio di esplosione. La frequenza del danno è F = FC + FM + FW + FZ."),
  );

  let esitoSenza: EsitoStruttura | null = null, esitoCon: EsitoStruttura | null = null, minimo: ClasseLps | null = null;
  if (x.rischio && x.rischio.zone.length) {
    const st = x.rischio.struttura, zone = x.rischio.zone;
    try {
      esitoSenza = calcolaZone(st, zone, { lps: "nessuno", spd: "nessuno" });
      esitoCon = calcolaZone(st, zone, { lps: lpl, spd: lpl });
      const m = protezioneMinimaZone(st, zone); minimo = m ? m.protezione.lps : null;
    } catch { esitoSenza = esitoCon = null; }
  }
  B.push(h2("6.4 Densità di fulminazione"),
    p([{ t: "La densità annua di fulmini a terra nella posizione della struttura vale " }, { t: `NG = ${it(d.densita)} fulmini/(anno·km²)`, b: true }, { t: `; la densità dei punti di impatto è NSG = k · NG = ${it((x.rischio?.struttura.k ?? 2) * d.densita)} punti/(anno·km²) con k = ${it(x.rischio?.struttura.k ?? 2)} (CEI EN IEC 62305-2:2024, A.1).` }]),
    p([{ t: "I valori di NG e NSG sono quelli dell'attestato rilasciato secondo la CEI EN IEC 62858 per le coordinate della struttura, allegato alla presente relazione. " }, dc("fornitore e data dell'attestato NG/NSG")]),
  );
  if (esitoSenza && esitoCon && x.rischio) {
    const st = x.rischio.struttura, zone = x.rischio.zone, e = esitoSenza;
    B.push(h2("6.5 Dati di ingresso e numero di eventi pericolosi"),
      tab(["Grandezza", "Valore"], [
        ["Dimensioni della struttura L × W × H", `${it(st.L)} × ${it(st.W)} × ${it(st.H)} m`],
        ["Fattore di posizione CD", it(st.CD)],
        ["Tensione di tenuta all'impulso Uw", `${it(st.Uw ?? 2.5)} kV`],
        [[...pedice("A", "D"), { t: " – area di raccolta (fulmini sulla struttura)" }], [...sci(e.AD), { t: " m²" }]],
        [[...pedice("A", "M"), { t: " – area di raccolta (fulmini vicino alla struttura)" }], [...sci(e.AM), { t: " m²" }]],
        [[...pedice("N", "D"), { t: " – fulmini sulla struttura" }], [...sci(e.ND), { t: " /anno" }]],
        [[...pedice("N", "M"), { t: " – fulmini vicino alla struttura" }], [...sci(e.NM), { t: " /anno" }]],
        [[...pedice("N", "L"), { t: " – fulmini sulle linee (somma)" }], [...sci(e.NL), { t: " /anno" }]],
        [[...pedice("N", "I"), { t: " – fulmini vicino alle linee (somma)" }], [...sci(e.NI), { t: " /anno" }]],
        ...(e.NDJ > 0 ? [[[...pedice("N", "DJ"), { t: " – fulmini sulle strutture adiacenti" }], [...sci(e.NDJ), { t: " /anno" }]] as Testo[]] : []),
      ], [7, 4]),
    );
    if (st.linee.length) B.push(h3("Linee entranti"), tab(["Linea", "Lunghezza (m)", "Posa CI", "Ambiente CE", "Tipo CT", "Ingresso / schermatura"], st.linee.map((l: Linea) => [l.nome, it(l.sezioni?.length ? l.sezioni.reduce((a, s) => a + s.lunghezza, 0) : l.lunghezza, 0), it(l.posa), it(l.ambiente), it(l.tipo), CONNESSIONI.find((c) => c.id === l.connessione)?.nome ?? (l.schermata ? "Schermata" : "Non schermata")]), [2, 1.4, 1, 1.2, 1, 4]));
    B.push(h3("Zone della struttura"), tab(["Zona", "Presenza (h/anno)", "Pavimento rt", "Rischio incendio rf", "Protezione incendio rp", "Categoria di perdita", "Misure contatto"], zone.map((z) => [z.nome, it(z.oreAnno, 0), PAVIMENTO.find((o) => o.valore === z.rt)?.nome ?? it(z.rt, 5), RISCHIO_INCENDIO.find((o) => o.id === z.rfId)?.nome ?? z.rfId, PROTEZIONE_INCENDIO.find((o) => o.valore === z.rp)?.nome ?? it(z.rp), (CATEGORIE.find((c) => c.id === z.categoria)?.nome ?? z.categoria).replace(/ \(.*\)$/, ""), MISURE_CONTATTO.find((o) => o.valore === z.misureContatto)?.nome ?? it(z.misureContatto, 3)]), [2, 1.3, 1.6, 2, 2, 1.6, 2]));
    const righeEsito = (es: EsitoStruttura): Testo[][] => es.zone.map((z) => [z.zona.nome, sci(z.RL1), sci(z.RL2), [...sci(z.R), { t: z.conforme ? "  ≤ RT" : "  > RT", b: true }], sci(z.F), [...sci(z.FT), { t: z.frequenzaConforme ? "  F ≤ FT" : "  F > FT", b: true }]]);
    B.push(h2("6.6 Risultati"),
      h3("Struttura senza misure di protezione"),
      tab(["Zona", "RL1", "RL2", "R", "F", "FT"], righeEsito(esitoSenza), [2.4, 1.6, 1.6, 2.2, 1.6, 2.2]),
      h3(`Struttura con le misure di progetto (LPS e SPD di livello ${lpl})`),
      tab(["Zona", "RL1", "RL2", "R", "F", "FT"], righeEsito(esitoCon), [2.4, 1.6, 1.6, 2.2, 1.6, 2.2]),
      h3("Componenti di rischio con le misure di progetto"),
      tab(["Zona", "RA", "RB", "RC", "RM", "RU", "RV", "RW", "RZ"], esitoCon.zone.map((z) => [z.zona.nome, sci(z.componenti.RA + z.componenti.RAD), sci(z.componenti.RB), sci(z.componenti.RC), sci(z.componenti.RM), sci(z.componenti.RU), sci(z.componenti.RV), sci(z.componenti.RW), sci(z.componenti.RZ)]), [1.6, 1, 1, 1, 1, 1, 1, 1, 1]),
    );
    const caso = esitoSenza.conforme && esitoSenza.frequenzaConforme ? 1 : esitoCon.conforme && esitoCon.frequenzaConforme ? 2 : 3;
    B.push(h2("6.7 Esito della valutazione"),
      el([{ t: "Caso 1 – Struttura autoprotetta: ", b: true }, { t: "R ≤ RT e F ≤ FT in tutte le zone senza misure di protezione." }],
        [{ t: "Caso 2 – Struttura protetta: ", b: true }, { t: "R ≤ RT e F ≤ FT in tutte le zone con le misure di protezione adottate." }],
        [{ t: "Caso 3 – Struttura non protetta: ", b: true }, { t: "in almeno una zona R > RT o F > FT: servono ulteriori misure." }]),
      p([{ t: "Esito: ", b: true }, { t: caso === 1 ? "Caso 1 – la struttura è autoprotetta." : caso === 2 ? `Caso 2 – con LPS e SPD di livello ${lpl} la struttura è protetta.` : `Caso 3 – con le misure di livello ${lpl} la struttura non risulta protetta.`, b: true }]),
      p(minimo ? `Protezione minima che rende R ≤ RT in tutte le zone: ${nomeProtezione(minimo)}.${minimo !== "nessuno" && LIVELLI.indexOf(minimo as Lpl) < LIVELLI.indexOf(lpl) ? " Il livello di progetto è inferiore a quello minimo: va rivisto." : ""}` : "Nessuna combinazione di LPS e SPD dello stesso livello porta R ≤ RT: servono altre misure (antincendio, schermature, misure di contatto)."),
      ...(caso !== 1 && !esitoCon.frequenzaConforme ? [p("La frequenza del danno F supera FT: vanno previste misure SPM (sistema coordinato di SPD, schermature, cablaggi) secondo la CEI EN IEC 62305-4.")] : []),
      p("Le valutazioni di natura economica sulla convenienza delle misure di protezione non sono state condotte, salvo diversa richiesta del committente.", { dimensione: 9 }),
    );
  } else {
    B.push(h2("6.5 Risultati"), p([{ t: x.risultati.rischio ? `Livello di protezione da valutazione: ${x.risultati.rischio.lpl} (${x.risultati.rischio.esito}). ` : "" }, dc(`valutazione del rischio non compilata nell'app (pagina Rischio). Livello di progetto dichiarato: ${lpl}`)]));
  }

  // ================= 7 LPS ESTERNO =================
  const par = parametriLPL as unknown as Record<string, { raggio: number; latoMaglia: number }>;
  const IMIN: Record<Lpl, number> = { I: 3, II: 5, III: 10, IV: 16 };
  const col = LIVELLI.indexOf(lpl) + 1;
  B.push(h1("7. Protezione contro le scariche atmosferiche (LPS esterno)"),
    p("L'LPS esterno ha il compito di intercettare i fulmini prima che colpiscano la struttura e di condurre e disperdere nel terreno la corrente di fulmine, evitando danni meccanici o chimici e scariche pericolose che possano innescare incendi. Si compone di:"),
    el("un sistema di captatori, che intercettano i fulmini diretti sulla struttura;", "un sistema di calate, che conducono a terra la corrente di fulmine senza danni;", "un sistema di dispersori, che disperdono la corrente nel terreno."),
    p("Forma, sezione e dimensioni dei conduttori e delle maglie dei captatori, delle calate e dei dispersori sono quelle della CEI EN IEC 62305-3:2024; l'idoneità dell'LPS è verificata con la valutazione del rischio secondo la CEI EN IEC 62305-2:2024."),
    h2("7.1 Impianto di captazione"),
    p("Il sistema di captatori è adeguato quando la struttura da proteggere è interamente nel volume protetto. Il posizionamento è verificato con il metodo della sfera rotolante e con il metodo della maglia: una parte della copertura è protetta se lo è con almeno uno dei due metodi."),
    tab(["Criteri di intercettazione", "I", "II", "III", "IV"], [
      ["Minimo valore della corrente di picco I (kA)", ...LIVELLI.map((l) => String(IMIN[l]))],
      ["Raggio della sfera rotolante R (m)", ...LIVELLI.map((l) => String(par[l]!.raggio))],
      [[{ t: "Lato della maglia W" }, { t: "m", sub: true }, { t: " (m)" }], ...LIVELLI.map((l) => `${par[l]!.latoMaglia} × ${par[l]!.latoMaglia}`)],
    ], [5, 1.5, 1.5, 1.5, 1.5], col),
    p(`Livello di progetto: LPL ${lpl} – raggio della sfera rotolante ${par[lpl]!.raggio} m, lato della maglia ${par[lpl]!.latoMaglia} m (colonna evidenziata).`, { grassetto: true }),
    p("Tutti i punti toccati dalla sfera sono i primi possibili punti di impatto e devono essere protetti da un captatore. Il punto di impatto è percorso dalla corrente totale, che poi si ripartisce tra i conduttori fino ai dispersori: il dimensionamento dei conduttori fa riferimento al caso più gravoso."),
    p("Elementi metallici che fanno parte della struttura e non possono essere modificati facilmente possono essere usati come componenti naturali di captazione, se adeguatamente dimensionati: lastre metalliche di copertura, componenti metallici del tetto sotto coperture non metalliche (se è accettabile il danneggiamento della copertura), gronde, ornamenti, ringhiere, tubazioni e serbatoi metallici sul tetto."),
    p("Sui tetti piani i captatori devono stare sopra il livello massimo probabile dell'acqua accumulata durante i temporali. Nell'installazione deve essere mantenuta la distanza di separazione da corpi metallici e impianti elettrici, di telecomunicazione e di segnale (vedi 7.3)."),
  );
  const capt = x.conduttori.filter((c) => c.tipo === "captazione"), lCapt = capt.reduce((a, c) => a + lunghezza(c), 0);
  const asteGr = new Map<string, { altezza: number; codice: string; n: number }>();
  for (const a of x.aste) { const k = `${a.altezza.toFixed(2)}|${a.codiceOBO}`; const g = asteGr.get(k); if (g) g.n++; else asteGr.set(k, { altezza: a.altezza, codice: a.codiceOBO, n: 1 }); }
  const ver = x.risultati.captazione?.verifica;
  B.push(h3("Soluzione di progetto"));
  if (capt.length || x.aste.length || x.risultati.captazione) {
    B.push(p(x.risultati.captazione?.descrizione ? x.risultati.captazione.descrizione : `Captazione con ${x.aste.length ? `${x.aste.length} aste` : ""}${x.aste.length && capt.length ? " e " : ""}${capt.length ? "conduttori a maglia" : ""}.`));
    const righeC: Testo[][] = [];
    if (capt.length) righeC.push(["Conduttori di captazione", `${it(lCapt, 1)} m (${capt.length} ${capt.length === 1 ? "tratto" : "tratti"})`]);
    const mat = [...new Set(capt.map((c) => [c.materiale, c.sezione ? `${c.sezione}${/^\d+$/.test(c.sezione) ? " mm²" : ""}` : ""].filter(Boolean).join(" ")).filter(Boolean))];
    if (mat.length) righeC.push(["Materiale e sezione", mat.join("; ")]);
    if (x.risultati.captazione) righeC.push(["Giunzioni / incroci", `${x.risultati.captazione.giunzioni} / ${x.risultati.captazione.incroci}`]);
    if (ver) righeC.push(["Superficie protetta (sfera / maglia)", `${it(ver.areaProtettaSfera, 1)} / ${it(ver.areaProtettaMaglia, 1)} m²`], ["Superficie esposta", `${it(ver.areaEsposta, 1)} m²`], ["Maglie conformi", `${ver.maglie.filter((m) => m.conforme).length} su ${ver.maglie.length}`]);
    if (righeC.length) B.push(tab(["Elemento", "Valore"], righeC, [5, 7]));
    if (asteGr.size) B.push(p("L'impianto di captazione sarà costituito da:"), el(...[...asteGr.values()].sort((a, b) => a.altezza - b.altezza).map((g): Testo => `N° ${g.n} – aste di altezza ${it(g.altezza)} m${g.codice ? ` (art. ${g.codice})` : ""}`)));
    if (ver && ver.areaEsposta > 0.5) B.push(p([{ t: `Attenzione: ${it(ver.areaEsposta, 1)} m² di copertura risultano esposti. `, b: true }, dc("integrare la captazione o motivare")]));
  } else B.push(p([dc("captazione non ancora disegnata nell'app (Edificio 3D)")]));
  B.push(p([dc("altezze da proteggere in copertura (impianti, parapetti) e profondità di penetrazione della sfera rotolante tra i captatori")]));

  // calate
  const calate = x.conduttori.filter((c) => c.tipo === "calata");
  const nCalate = calate.length || x.risultati.calate?.numero || 0;
  const per = corpi.reduce((t, c) => t + perimetro(c.impronta), 0) || (d.L > 0 && d.W > 0 ? 2 * (d.L + d.W) : 0);
  const dist = (distanzaCalate as unknown as Record<string, { distanzaTipica: number }>)[lpl]?.distanzaTipica ?? 0;
  B.push(h2("7.2 Calate"),
    p("Il sistema delle calate conduce la corrente di fulmine dal sistema di captatori al sistema di dispersori. Le calate sono distribuite il più uniformemente possibile lungo il perimetro, partendo dagli angoli, con percorsi brevi, rettilinei e paralleli; ripartire la corrente su più calate riduce il rischio di scariche laterali e i disturbi elettromagnetici all'interno della struttura."),
    el(`Distanza tipica tra le calate per LPL ${lpl}: ${dist} m (CEI EN IEC 62305-3:2024, Tab. 5);`, "con captatori ad asta almeno una calata per ogni asta; con funi una calata a ciascuna estremità; con la maglia calate perimetrali, almeno 2;", "calate lontane da porte e finestre; pluviali metallici collegati alle calate nei punti di incrocio e alla base all'impianto equipotenziale o di terra;", "dove possibile, conduttori ad anello di interconnessione delle calate."),
  );
  if (nCalate) {
    B.push(tab(["Elemento", "Valore"], [
      ["Numero di calate", String(nCalate)],
      ["Perimetro della struttura", `${it(per, 1)} m`],
      ["Distanza media tra le calate", per > 0 ? `${it(per / nCalate, 1)} m` : "—"],
      ["Distanza tipica ammessa (LPL " + lpl + ")", `${dist} m`],
      ...(calate.length ? [["Lunghezza totale delle calate", `${it(calate.reduce((a, c) => a + lunghezza(c), 0), 1)} m`] as Testo[]] : x.risultati.calate ? [["Lunghezza conduttori di calata", `${it(x.risultati.calate.lunghezzaConduttori, 1)} m`] as Testo[]] : []),
    ], [5, 7]));
    if (per > 0 && per / nCalate > dist * 1.001) B.push(p([{ t: "La distanza media supera quella tipica: ", b: true }, dc("aumentare le calate o motivare (componenti naturali, calate esistenti)")]));
  } else B.push(p([dc("numero e posizione delle calate (esistenti o di progetto)")]));

  // separazione
  const ki = x.separazione.ki ?? KI[lpl], kc = kcSemplificato(Math.max(1, nCalate || 1));
  const km = { ...KM, ...(x.separazione.kmSolido ? { solido: x.separazione.kmSolido } : {}) };
  const esiti = verificaPunti(x.separazione.punti, ki, kc, km);
  B.push(h2("7.3 Distanza di separazione"),
    p([{ t: "Tra l'LPS e le parti metalliche o gli impianti interni deve essere rispettata la distanza di separazione s, calcolata con il metodo semplificato della CEI EN IEC 62305-3:2024: " }]),
    p([{ t: "s = (k" }, { t: "i", sub: true }, { t: " × k" }, { t: "c", sub: true }, { t: " / k" }, { t: "m", sub: true }, { t: ") × l" }], { formula: true }),
    p([{ t: `con ki = ${it(ki, 3)} (LPL ${lpl}), kc = ${it(kc, 3)} (${nCalate || 1} calate), km = 1 in aria e ${it(km.solido, 2)} in materiale solido; l è la lunghezza lungo l'LPS dal punto considerato al più vicino collegamento equipotenziale. Dove la distanza non può essere rispettata si prevede il collegamento equipotenziale, una base isolante del captatore o un numero maggiore di calate.` }]),
  );
  if (esiti.length) B.push(tab(["Punto", "Materiale", "l (m)", "s richiesta (m)", "d effettiva (m)", "Esito"], esiti.map((e) => [e.descrizione || e.id, NOMI_MATERIALE[e.materiale].replace(/ \(.*\)$/, ""), it(e.l, 2), it(e.s, 3), it(e.d, 3), e.conforme ? "Conforme" : [{ t: "Non conforme", b: true }]]), [3, 2.5, 1, 1.5, 1.5, 1.6]));
  else B.push(p([dc("punti critici (impianti in copertura, parti metalliche) con la distanza effettiva")]));

  // materiali
  B.push(h2("7.4 Materiali e dimensioni minime"),
    p("Materiali, configurazioni e sezioni minime dei conduttori e delle aste di captazione e di calata sono quelli della CEI EN IEC 62305-3:2024 e dei componenti conformi alla serie CEI EN IEC 62561. Questi requisiti derivano dalla conduttività dei materiali (riscaldamento al passaggio della corrente di fulmine) e dalle sollecitazioni meccaniche in uso."),
    p([{ t: "Per captazione e calate si prevedono conduttori tondi Ø 8 mm (50 mm²) in alluminio o in acciaio zincato a caldo. Con un tondo Ø 8 mm come punta di captazione l'altezza libera massima è 0,5 m; con Ø 10 mm è 1 m. I supporti dei conduttori sono posati di norma a 1 m (0,5 m per conduttori verticali oltre 20 m o orizzontali su superfici verticali). " }, ...(lCapt || calate.length ? [] : [dc("materiali effettivi")])]),
  );

  // ================= 8 TERRA =================
  B.push(h1("8. Impianto di terra"));
  const pic = x.picchetti, t = x.terra;
  if (t || pic.length || x.risultati.terra) {
    const area = corpi.reduce((a, c) => a + areaPoligono(c.impronta), 0) || d.L * d.W;
    const re = t && t.tipo !== "A" ? Math.sqrt((area + (t.tipo === "B" ? per * t.distanzaAnello : 0)) / Math.PI) : null;
    const righeT: Testo[][] = [
      ["Tipo di dispersore", t ? (t.tipo === "A" ? "Tipo A – dispersori verticali o radiali" : t.tipo === "B" ? "Tipo B – anello esterno" : "Dispersore di fondazione") : x.risultati.terra?.descrizione ?? "—"],
    ];
    if (pic.length) { const lo = Math.min(...pic.map((q) => q.lunghezza)), hi = Math.max(...pic.map((q) => q.lunghezza)); righeT.push(["Picchetti", `${pic.length} × ${it(lo)}${hi > lo ? `–${it(hi)}` : ""} m`]); }
    else if (x.risultati.terra?.numeroPicchetti) righeT.push(["Picchetti", `${x.risultati.terra.numeroPicchetti} × ${it(x.risultati.terra.lunghezzaPicchetto)} m`]);
    if (t?.tipo === "B") righeT.push(["Anello", `a ${it(t.distanzaAnello)} m dall'edificio, profondità ${it(t.profondita)} m`]);
    if (t?.l1 != null) righeT.push([[{ t: "Lunghezza minima l" }, { t: "1", sub: true }, { t: " (resistività del terreno)" }], `${it(t.l1)} m`]);
    if (re != null) righeT.push([[{ t: "Raggio equivalente r" }, { t: "e", sub: true }], `${it(re, 1)} m`]);
    B.push(p("Il sistema di dispersori disperde nel terreno la corrente di fulmine senza sovratensioni pericolose. È unico per l'LPS e per l'impianto elettrico ed è collegato al collettore principale di terra."), tab(["Elemento", "Valore"], righeT, [5, 7]));
  } else B.push(p([dc("impianto di terra esistente o di progetto (tipo, collegamenti, misure di resistenza)")]));

  // ================= 9 SPD =================
  B.push(h1("9. Protezione degli impianti interni (SPD)"),
    p("Le linee metalliche entranti (energia, telecomunicazioni, dati) sono collegate all'impianto equipotenziale all'ingresso nella struttura, direttamente o tramite SPD, per evitare scariche pericolose e proteggere gli impianti interni secondo la CEI EN IEC 62305-4:2024."));
  if (x.risultati.spd?.dispositivi.length) B.push(p(x.risultati.spd.descrizione), tab(["Codice", "Descrizione", "Quantità"], x.risultati.spd.dispositivi.map((s) => [s.codice, s.descrizione, String(s.quantita)]), [2, 8, 1.5]));
  else B.push(p([dc(`SPD previsti per le linee entranti (livello ${lpl}) o SPD esistenti`)]));

  // ================= 10 TIPOLOGICI =================
  const gruppi = new Map<string, { p: ParticolareLib; righe: RigaComputo[] }>();
  for (const riga of x.righe) { const pa = particolareDiRiga(riga, x.particolari); if (!pa) continue; const g = gruppi.get(pa.id); if (g) g.righe.push(riga); else gruppi.set(pa.id, { p: pa, righe: [riga] }); }
  B.push(h1("10. Particolari costruttivi (tipologici)"));
  if (gruppi.size) {
    B.push(p("In dettaglio, i componenti necessari secondo i tipologici OBO applicati nel progetto sono i seguenti (quantità totali dal computo; quantità tipica = per singola applicazione del particolare)."));
    let n = 0;
    for (const { p: pa, righe } of gruppi.values()) {
      n++;
      const tipica = (codice: string) => { const c = pa.componenti.find((k) => k.codiceOBO === codice); return c && c.quantita != null ? `${it(c.quantita)}${UNITA_TIPICA[c.unitaQuantita ?? ""] ?? ""}` : ""; };
      const unite = new Map<string, { codice: string; descrizione: string; q: number; unita: string }>();
      for (const rr of righe) { const k = `${rr.codice}|${rr.unita}`; const u = unite.get(k); if (u) u.q += rr.quantita; else unite.set(k, { codice: rr.codice, descrizione: rr.descrizione, q: rr.quantita, unita: rr.unita }); }
      B.push(h3(`Tipologico ${n} – ${pa.nome ?? pa.id}`), p(`Riferimento OBO: ${pa.id}`, { dimensione: 9, spazioDopo: 2 }),
        tab(["Art. No", "Tipo │ Descrizione", "Qty TOT (m / pz)", "Qty tipico"], [...unite.values()].map((u) => [[{ t: u.codice || "—", b: true }], u.descrizione.replace(/ – /, " │ "), `${it(u.q)} ${u.unita}`, tipica(u.codice)]), [1.6, 6.5, 1.8, 1.6]));
    }
  } else B.push(p([dc("nessun particolare costruttivo collegato alle righe del computo")]));

  // ================= 11 ELENCO MATERIALE =================
  B.push(h1("11. Elenco materiale"));
  if (x.righe.length) {
    for (const cat of categorie) {
      const gr = x.righe.filter((rr) => rr.categoria === cat); if (!gr.length) continue;
      B.push(h3(cat.charAt(0).toUpperCase() + cat.slice(1)), tab(["Art. No", "Descrizione", "Quantità", "Unità"], gr.map((rr) => [rr.codice || "Da assegnare", rr.descrizione, it(rr.quantita), rr.unita]), [1.6, 7.5, 1.5, 1]));
    }
    if (x.mancanti.length) B.push(p([{ t: "Computo incompleto – dati mancanti: ", b: true }, { t: x.mancanti.join("; ") }], { dimensione: 9 }));
  } else B.push(p([dc("elenco materiale (pagina Computo materiali)")]));

  // ================= 12 VERIFICHE =================
  B.push(h1("12. Verifiche e manutenzione"),
    p("Al termine dei lavori l'installatore rilascia la dichiarazione di conformità (D.M. 37/2008). L'impianto è soggetto alla denuncia e alle verifiche periodiche del D.P.R. 462/2001. L'LPS va esaminato a vista periodicamente e verificato in modo completo secondo il piano di manutenzione della CEI EN IEC 62305-3:2024, e comunque dopo ogni fulminazione accertata o modifica della struttura."));

  // ================= 13 ALLEGATI =================
  B.push(h1("13. Allegati"), el("Attestato dei valori NG e NSG (CEI EN IEC 62858) – documento del fornitore dei dati, allegato in originale", "Disegni di posizionamento del sistema di captazione e delle calate", "Schede dei particolari costruttivi OBO", "Elenco materiale (Excel)"),
    p("Calcoli di supporto alla progettazione eseguiti con OBO Hub · Progettazione LPS (CEI EN IEC 62305:2024). Il documento va verificato, completato nelle parti evidenziate e firmato da un tecnico abilitato.", { dimensione: 9, spazioPrima: 12 }),
    p([{ t: "Il tecnico  " }, dc("nome, albo e firma")], { allinea: "destra", spazioPrima: 24 }),
  );

  return {
    titolo: `Relazione LPS – ${titolo || d.comune || "progetto"}`,
    intestazione: `${titolo || "Relazione tecnica LPS"}${d.comune ? ` – ${d.comune}` : ""} · Relazione impianto di protezione dalle scariche atmosferiche${rev ? ` · Rev. ${rev}` : ""}`,
    piede: [
      [{ t: "OBO Bettermann S.r.l.", b: true }, { t: " a socio unico · Via Ferrero 16 – 10098 Cascine Vica Rivoli (TO) · Tel. +39 011 9548 811" }],
      "R.E.A. n° 1035379 – Registro Imprese n° 09227890010 Trib. di Torino – Cap. Soc. € 300.000 i.v. – C.Fisc./P.IVA 09227890010",
      "Società soggetta all'attività di direzione e coordinamento di Arvigrat Holding AG",
    ],
    blocchi: B,
  };
}

/** RT usato (per i controlli esterni). */
export const RISCHIO_TOLLERABILE = RT;
