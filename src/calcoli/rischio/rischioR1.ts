/**
 * Analisi del rischio secondo CEI EN IEC 62305-2:2024, con la struttura divisa in una o più zone ZS (8.3–8.5).
 *
 * Edizione 2024, in sintesi (riferimenti alla norma tra parentesi):
 *  - un solo rischio R = R_L1 (vite umane) + R_L2 (danni materiali), da confrontare con RT = 10⁻⁵ (7.3);
 *  - la perdita di servizio e la perdita economica non sono più un rischio: si valuta la frequenza
 *    del danno agli impianti interni F = FC + FM + FW + FZ, da confrontare con FT (9.3);
 *  - densità dei punti di impatto al suolo NSG = k·NG, con k = 2 se il fornitore dei dati non dà k (A.1);
 *  - NM e NI dipendono dalla tensione di tenuta Uw: rM = 350/Uw, rI = 2000/Uw^1,8 (A.3, A.5), entrambi divisi per k;
 *  - linea interrata CI = 0,3 (Tab. A.2);
 *  - rp e rf entrano nelle probabilità PB e PV (B.4, B.8), le perdite tipiche dipendono dalla categoria
 *    della struttura (Tab. C.2), il fattore hz non c'è più.
 * Componenti (Tab. 3): RAT, RB1, RC1, RM1, RU, RV1, RW1, RZ1 (L1) · RB2, RC2, RM2, RV2, RW2, RZ2 (L2).
 * RC, RM, RW, RZ per L1 solo dove il guasto degli impianti mette in pericolo la vita (ospedali, esplosione);
 * per L2 solo con rischio di esplosione. RAD per le zone con persone esposte (tetto, terrazza).
 * Numero di eventi comune a tutta la struttura (Allegato A, compresa la struttura adiacente NDJ);
 * probabilità (Allegato B: TWS, PMS con KS1–KS3, CLD/CLI Tab. B.9, Pe) e perdite (Allegato C) per ogni zona.
 * Il confronto con RT e FT si fa zona per zona; non è considerata la perdita esterna LE (Allegato E).
 */
import { areaRaccolta } from "./areaRaccolta";

export type Livello = "I" | "II" | "III" | "IV";
export type ClasseLps = "nessuno" | Livello;

export interface Opzione { id: string; nome: string; valore: number }
const o = (id: string, nome: string, valore: number): Opzione => ({ id, nome, valore });

/** Rischio tollerabile RT (7.3, Nota 1). */
export const RT_R1 = 1e-5;
export const RT = RT_R1;
/** Frequenza tollerabile del danno FT (9.3, Nota 1): impianti critici 0,1, non critici 1 all'anno. */
export const FT_CRITICI = 0.1, FT_NON_CRITICI = 1;

/** PLPS (Tab. B.3) in funzione della classe dell'LPS. */
export const PLPS: Record<ClasseLps, number> = { nessuno: 1, IV: 0.2, III: 0.1, II: 0.05, I: 0.02 };
/** Mantenuto per compatibilità: è il PLPS. */
export const PB = PLPS;
/** PEB (Tab. B.13): SPD per il collegamento equipotenziale all'ingresso delle linee. */
export const PEB: Record<ClasseLps, number> = { nessuno: 1, IV: 0.05, III: 0.05, II: 0.02, I: 0.01 };
/** PSPD (Tab. B.7/B.8): sistema coordinato di SPD. */
export const PSPD: Record<ClasseLps, number> = { nessuno: 1, IV: 0.05, III: 0.05, II: 0.02, I: 0.01 };

/** PAM (Tab. B.1): misure contro tensioni di contatto e di passo. */
export const MISURE_CONTATTO: Opzione[] = [o("nessuna", "Nessuna misura", 1), o("cartelli", "Cartelli ammonitori", 0.1), o("isolamento", "Isolamento elettrico delle parti accessibili (es. calate)", 0.01), o("equipotenziale", "Equipotenzializzazione del suolo con dispersore a maglia", 0.01), o("naturale", "LPS naturale (struttura metallica o c.a. interconnesso)", 1e-3), o("barriere", "Limitazioni di accesso", 0)];
/** CI (Tab. A.2). */
export const POSA_LINEA: Opzione[] = [o("aerea", "Aerea", 1), o("interrata", "Interrata", 0.3), o("interrata-maglia", "Interrata dentro un dispersore magliato", 0.01)];
/** CE (Tab. A.4). */
export const AMBIENTE_LINEA: Opzione[] = [o("rurale", "Rurale", 1), o("suburbano", "Suburbano", 0.5), o("urbano", "Urbano", 0.1), o("urbano-alto", "Urbano con edifici alti (> 20 m)", 0.01)];
/** CT (Tab. A.3). */
export const TIPO_LINEA: Opzione[] = [o("bt", "Bassa tensione, telecomunicazioni, dati", 1), o("mt", "Media/alta tensione con trasformatore a avvolgimenti separati", 0.2)];
/** rt (Tab. B.2). */
export const PAVIMENTO: Opzione[] = [o("terra", "Agricolo, cemento", 1e-2), o("marmo", "Marmo, ceramica", 1e-3), o("ghiaia", "Pietrisco, moquette, tappeti", 1e-4), o("asfalto", "Asfalto, linoleum, legno", 1e-5)];
/** rf (Tab. B.6). */
export const RISCHIO_INCENDIO: Opzione[] = [o("esplosione", "Esplosione: zone 0, 20 ed esplosivi solidi", 1), o("esplosione-1", "Esplosione: zone 1, 21", 1e-1), o("esplosione-2", "Esplosione: zone 2, 22", 1e-3), o("alto", "Incendio alto (> 800 MJ/m²)", 1e-1), o("ordinario", "Incendio ordinario (400–800 MJ/m²)", 1e-2), o("ridotto", "Incendio basso (< 400 MJ/m²)", 1e-3), o("nessuno", "Nessuno", 0)];
/** rp (Tab. B.5). */
export const PROTEZIONE_INCENDIO: Opzione[] = [o("nessuna", "Nessuna", 1), o("manuale", "Estintori, idranti, allarme manuale, compartimentazione, vie di fuga", 0.5), o("automatica", "Impianto automatico di spegnimento o di allarme", 0.2)];
/** PS (Tab. B.4): vale solo senza LPS conforme alla 62305-3 (con LPS PS = 1). */
export const TIPO_STRUTTURA: Opzione[] = [o("muratura", "Legno e muratura", 1), o("ca", "Cemento armato continuo o struttura metallica interconnessa", 0.5)];

/** Categoria della struttura (Tab. C.2) con i valori di perdita consigliati come predefiniti (i più alti). */
export interface Categoria { id: string; nome: string; LF: number; LO: number }
export const CATEGORIE: Categoria[] = [
  { id: "molto-elevata", nome: "Perdita molto elevata (rischio di esplosione, sale operatorie, terapia intensiva)", LF: 2e-1, LO: 1e-2 },
  { id: "elevata", nome: "Perdita elevata (degenze, carceri, sale controllo, centrali, musei)", LF: 1e-1, LO: 1e-3 },
  { id: "normale", nome: "Perdita normale (aperte al pubblico: scuole, uffici, alberghi, supermercati)", LF: 5e-2, LO: 5e-4 },
  { id: "bassa", nome: "Perdita bassa (proprietà privata: condomini, fattorie)", LF: 2e-2, LO: 1e-4 },
];
/** Mantenuto per i progetti salvati con l'edizione precedente: destinazione → LF. */
export const DESTINAZIONE: Opzione[] = CATEGORIE.map((c) => o(c.id, c.nome, c.LF));
export const LT = 1e-2;

/** Schermatura della linea per la Tab. B.11 (schermo collegato alla stessa barra equipotenziale delle apparecchiature). */
export type Schermatura = "no" | "5-20" | "1-5" | "<1";
export const SCHERMATURE: { id: Schermatura; nome: string }[] = [
  { id: "no", nome: "Non schermata (o schermo non collegato)" }, { id: "5-20", nome: "Schermata, 5–20 Ω/km" }, { id: "1-5", nome: "Schermata, 1–5 Ω/km" }, { id: "<1", nome: "Schermata, ≤ 1 Ω/km" },
];
const UW_COLONNE = [0.35, 0.5, 1, 1.5, 2.5, 4, 6, 12];
const TAB_B11: Record<Exclude<Schermatura, "no">, number[]> = {
  "5-20": [1, 1, 1, 1, 0.95, 0.9, 0.8, 0.4],
  "1-5": [1, 1, 0.9, 0.8, 0.6, 0.3, 0.1, 0.02],
  "<1": [1, 0.85, 0.6, 0.4, 0.2, 0.04, 0.02, 0.005],
};
/** PLD (Tab. B.11): colonna di Uw uguale o immediatamente inferiore (scelta cautelativa). */
export function probabilitaPLD(s: Schermatura, Uw: number): number {
  if (s === "no") return 1;
  let i = 0; UW_COLONNE.forEach((u, k) => { if (Uw >= u) i = k; });
  return TAB_B11[s][i]!;
}

/** Tipo di linea e collegamento all'ingresso (Tab. B.9): CLD (fulmini sulla linea) e CLI (vicino alla linea). */
export interface Connessione { id: string; nome: string; CLD: number; CLI: number; schermoCollegato?: boolean }
export const CONNESSIONI: Connessione[] = [
  { id: "aerea-ns", nome: "Aerea non schermata", CLD: 1, CLI: 1 },
  { id: "interrata-ns", nome: "Interrata non schermata", CLD: 1, CLI: 1 },
  { id: "neutro-multiplo", nome: "Linea di energia con neutro a terra in più punti", CLD: 1, CLI: 0.2 },
  { id: "sch-int-nc", nome: "Schermata interrata, schermo non collegato alla barra delle apparecchiature", CLD: 1, CLI: 0.3 },
  { id: "sch-aer-nc", nome: "Schermata aerea, schermo non collegato alla barra delle apparecchiature", CLD: 1, CLI: 0.1 },
  { id: "sch-coll", nome: "Schermata, schermo collegato alla barra delle apparecchiature", CLD: 1, CLI: 0, schermoCollegato: true },
  { id: "cavo-protezione", nome: "Cavo di protezione o condotto per la protezione dei cavi contro il fulmine", CLD: 0, CLI: 0 },
  { id: "interfaccia", nome: "Interfacce di separazione (CEI EN IEC 62305-4)", CLD: 0, CLI: 0 },
  { id: "nessuna", nome: "Nessuna linea metallica (fibra ottica)", CLD: 0, CLI: 0 },
];
/** KS3 (Tab. B.10): cablaggio interno. */
export const CABLAGGIO: Opzione[] = [
  o("nessuna", "Cavi non schermati, nessuna attenzione alle spire (spira ~50 m²)", 1),
  o("larghe-25", "Cavi non schermati, evitate le spire larghe (spira ~25 m²)", 0.5),
  o("larghe-10", "Cavi non schermati, evitate le spire larghe (spira ~10 m²)", 0.2),
  o("stesso-condotto", "Conduttori nello stesso condotto (spira ~0,5 m²)", 0.01),
  o("schermati", "Cavi schermati o in condotti metallici collegati a entrambe le estremità", 1e-4),
];

/** Struttura adiacente all'altra estremità della linea (A.2.5). */
export interface Adiacente { L: number; W: number; H: number; CDJ: number }

export interface Linea { nome: string; lunghezza: number; posa: number; ambiente: number; tipo: number; schermata: boolean; schermatura?: Schermatura; connessione?: string; adiacente?: Adiacente | null }

/** Zona di rischio ZS (8.3): caratteristiche omogenee. */
export interface Zona {
  id: string; nome: string;
  /** ore all'anno con persone presenti (PP = ore/8760) */
  oreAnno: number;
  rt: number; rp: number; rfId: string; categoria: string; misureContatto: number;
  /** zona esterna o con persone fino a 3 m dalle calate: include RAT */
  esterna: boolean;
  /** persone esposte al fulmine diretto (tetto, terrazza, parcheggio in copertura): include RAD */
  esposti: boolean;
  /** LD: perdita per fulmine diretto su persone esposte (Tab. C.2: 10⁻²–10⁻¹) */
  LD?: number;
  impiantiCritici: boolean;
  serviziCritici: boolean;
  /** indici delle linee che alimentano gli impianti della zona (null = tutte) */
  linee?: number[] | null;
  /** schermatura spaziale: lato maglia dell'LPS/struttura (KS1) e schermi interni (KS2), m; null = nessuna */
  wm1?: number | null; wm2?: number | null;
  /** KS3 cablaggio interno */
  ks3?: number;
  /** ore all'anno con apparecchiature esposte (Pe = ore/8760) */
  oreApparecchi?: number;
}

/** Dati comuni della struttura. */
export interface Struttura {
  L: number; W: number; H: number; NG: number; CD: number;
  k?: number; Uw?: number; PS?: number;
  /** probabilità che il sistema di allerta temporali non rilevi l'evento (1 = nessun TWS) */
  PTWS?: number;
  danniMateriali?: boolean;
  linee: Linea[];
}


export interface DatiRischio {
  L: number; W: number; H: number;
  /** NG dalla mappa (fulmini/km²·anno) */
  NG: number; CD: number;
  /** k: NSG = k·NG (A.1); 2 se non fornito */
  k?: number;
  /** tensione di tenuta all'impulso più bassa degli impianti (kV) */
  Uw?: number;
  linee: Linea[];
  rt: number; rp: number; rf: number;
  /** voce scelta di rf (Tab. B.6): distingue le zone con rischio di esplosione da quelle d'incendio con lo stesso valore */
  rfId?: string;
  /** categoria di perdita (Tab. C.2) */
  categoria?: string;
  /** LF dei progetti salvati prima del 2024: usato solo se manca la categoria */
  LF: number;
  /** non più usato dall'edizione 2024 (resta per i progetti salvati) */
  hz?: number;
  PS?: number;
  misureContatto: number;
  impiantiCritici: boolean;
  /** considera anche i danni materiali L2 (default sì: R = RL1 + RL2) */
  danniMateriali?: boolean;
  /** impianti interni critici per il servizio: FT = 0,1 invece di 1 */
  serviziCritici?: boolean;
  /** PP = tz/8760: frazione del tempo con persone presenti */
  frazionePresenza: number;
}

export interface Protezione { lps: ClasseLps; spd: ClasseLps }

export interface Componenti { RA: number; RB: number; RC: number; RM: number; RU: number; RV: number; RW: number; RZ: number }
export interface Frequenze { FC: number; FM: number; FW: number; FZ: number }
export interface EsitoRischio {
  NSG: number; ND: number; NM: number; NL: number; NI: number; AD: number; AM: number;
  /** componenti sommate su L1 e L2 (per le barre) */
  componenti: Componenti;
  RL1: number; RL2: number;
  /** rischio totale R (nome storico R1) */
  R1: number; conforme: boolean;
  frequenze: Frequenze; F: number; FT: number; frequenzaConforme: boolean;
}

/** AM (A.8): rM = 350/Uw. */
export function areaVicinanze(L: number, W: number, Uw = 2.5): number {
  const rM = 350 / Uw;
  return 2 * rM * (L + W) + Math.PI * rM * rM;
}

/** rf dalla voce scelta (o dal valore dei progetti salvati prima). */
export const rfDi = (d: DatiRischio): number => RISCHIO_INCENDIO.find((x) => x.id === d.rfId)?.valore ?? d.rf;

export const categoriaDi = (d: DatiRischio): Categoria =>
  CATEGORIE.find((c) => c.id === d.categoria) ?? CATEGORIE.find((c) => c.LF === d.LF) ?? CATEGORIE[2]!;

export interface EsitoZona {
  zona: Zona;
  componenti: Componenti & { RAD: number };
  RL1: number; RL2: number; R: number; conforme: boolean;
  frequenze: Frequenze; F: number; FT: number; frequenzaConforme: boolean;
}
export interface EsitoStruttura {
  NSG: number; ND: number; NM: number; NL: number; NDJ: number; NI: number; AD: number; AM: number;
  zone: EsitoZona[];
  /** rischio della zona peggiore */
  Rmax: number; conforme: boolean; frequenzaConforme: boolean;
}

const pms = (z: Zona): number => {
  const ks1 = z.wm1 != null && z.wm1 > 0 ? Math.min(1, 0.12 * z.wm1) : 1;
  const ks2 = z.wm2 != null && z.wm2 > 0 ? Math.min(1, 0.12 * z.wm2) : 1;
  return Math.pow(ks1 * ks2 * (z.ks3 ?? 1), 2);
};

/** Rischio e frequenza del danno per ogni zona (8.5): N comuni a tutta la struttura, P e L della zona. */
export function calcolaZone(st: Struttura, zone: Zona[], p: Protezione): EsitoStruttura {
  const k = st.k && st.k > 0 ? st.k : 2;
  const Uw = st.Uw && st.Uw > 0 ? st.Uw : 2.5;
  const PTWS = st.PTWS ?? 1;
  const NSG = k * st.NG;
  const AD = areaRaccolta(st.L, st.W, st.H);
  const AM = areaVicinanze(st.L, st.W, Uw);
  const ND = NSG * AD * st.CD * 1e-6;
  const NM = (1 / k) * NSG * AM * 1e-6;
  const rI = 2000 / Math.pow(Uw, 1.8);
  const plps = PLPS[p.lps], peb = PEB[p.spd], pspd = PSPD[p.spd];
  const PS = p.lps === "nessuno" ? (st.PS ?? 1) : 1;
  const conL2 = st.danniMateriali !== false;

  const linee = st.linee.map((l) => {
    const C = l.posa * l.ambiente * l.tipo;
    const NL = NSG * 40 * l.lunghezza * C * 1e-6;
    const NI = (1 / k) * NSG * 2 * rI * l.lunghezza * C * 1e-6;
    const NDJ = l.adiacente ? NSG * areaRaccolta(l.adiacente.L, l.adiacente.W, l.adiacente.H) * l.adiacente.CDJ * l.tipo * 1e-6 : 0;
    const conn = CONNESSIONI.find((c) => c.id === l.connessione) ?? (l.schermata ? CONNESSIONI.find((c) => c.id === "sch-coll")! : CONNESSIONI[0]!);
    const sch: Schermatura = conn.schermoCollegato ? (l.schermatura && l.schermatura !== "no" ? l.schermatura : "1-5") : "no";
    return { NL, NI, NDJ, CLD: conn.CLD, CLI: conn.CLI, PLD: probabilitaPLD(sch, Uw) };
  });
  const NL = linee.reduce((a, l) => a + l.NL, 0), NI = linee.reduce((a, l) => a + l.NI, 0), NDJ = linee.reduce((a, l) => a + l.NDJ, 0);

  const esiti = zone.map((z): EsitoZona => {
    const cat = CATEGORIE.find((c) => c.id === z.categoria) ?? CATEGORIE[2]!;
    const rf = RISCHIO_INCENDIO.find((x) => x.id === z.rfId)?.valore ?? 1e-2;
    const esplosione = z.rfId.startsWith("esplosione");
    const PP = Math.min(1, Math.max(0, z.oreAnno / 8760));
    const Pe = Math.min(1, Math.max(0, (z.oreApparecchi ?? 8760) / 8760));
    const LF1 = cat.LF, LF2 = conL2 ? cat.LF : 0;
    const LO1 = z.impiantiCritici ? cat.LO : 0, LO2 = conL2 && esplosione ? cat.LO : 0;
    const LD = z.LD ?? 1e-1;
    const servite = linee.filter((_, i) => z.linee == null || z.linee.includes(i));

    const PAT = plps * z.misureContatto * z.rt * PTWS;
    const PAD = PTWS * z.misureContatto * plps;
    const PB = PS * plps * z.rp * rf;
    const PC = 1 - servite.reduce((a, l) => a * (1 - pspd * l.CLD), 1);
    const PM = pspd * pms(z);

    const RA = z.esterna ? ND * PAT * PP * LT : 0;
    const RAD = z.esposti ? ND * PAD * PP * LD : 0;
    const RB1 = ND * PB * PP * LF1, RB2 = ND * PB * LF2;
    const RC1 = ND * PC * PP * Pe * LO1, RC2 = ND * PC * Pe * LO2;
    const RM1 = NM * PM * PP * Pe * LO1, RM2 = NM * PM * Pe * LO2;
    let RU = 0, RV1 = 0, RV2 = 0, RW1 = 0, RW2 = 0, RZ1 = 0, RZ2 = 0, FW = 0, FZ = 0;
    for (const l of servite) {
      const n = l.NL + l.NDJ;
      const PU = z.misureContatto * peb * l.PLD * PTWS * l.CLD * z.rt;
      const PV = peb * l.PLD * PTWS * l.CLD * z.rp * rf;
      const PW = pspd * PTWS * l.PLD * l.CLD;
      const PZ = pspd * PTWS * l.CLI;
      RU += n * PU * PP * LT;
      RV1 += n * PV * PP * LF1; RV2 += n * PV * LF2;
      RW1 += n * PW * PP * Pe * LO1; RW2 += n * PW * Pe * LO2;
      RZ1 += l.NI * PZ * PP * Pe * LO1; RZ2 += l.NI * PZ * Pe * LO2;
      FW += n * PW * Pe; FZ += l.NI * PZ * Pe;
    }
    const RL1 = RA + RAD + RB1 + RC1 + RM1 + RU + RV1 + RW1 + RZ1;
    const RL2 = RB2 + RC2 + RM2 + RV2 + RW2 + RZ2;
    const R = RL1 + RL2;
    const frequenze = { FC: ND * PC * Pe, FM: NM * PM * Pe, FW, FZ };
    const F = frequenze.FC + frequenze.FM + frequenze.FW + frequenze.FZ;
    const FT = z.serviziCritici ? FT_CRITICI : FT_NON_CRITICI;
    return {
      zona: z, componenti: { RA, RAD, RB: RB1 + RB2, RC: RC1 + RC2, RM: RM1 + RM2, RU, RV: RV1 + RV2, RW: RW1 + RW2, RZ: RZ1 + RZ2 },
      RL1, RL2, R, conforme: R <= RT, frequenze, F, FT, frequenzaConforme: F <= FT,
    };
  });
  return {
    NSG, ND, NM, NL, NDJ, NI, AD, AM, zone: esiti,
    Rmax: Math.max(0, ...esiti.map((e) => e.R)),
    conforme: esiti.every((e) => e.conforme), frequenzaConforme: esiti.every((e) => e.frequenzaConforme),
  };
}

/** Protezione minima (stesso livello per LPS e SPD) perché tutte le zone abbiano R ≤ RT. */
export function protezioneMinimaZone(st: Struttura, zone: Zona[]): { protezione: Protezione; esito: EsitoStruttura } | null {
  for (const l of ["nessuno", "IV", "III", "II", "I"] as ClasseLps[]) {
    const protezione = { lps: l, spd: l };
    const esito = calcolaZone(st, zone, protezione);
    if (esito.conforme) return { protezione, esito };
  }
  return null;
}
/** SPD minimo perché in tutte le zone F ≤ FT, con l'LPS scelto. */
export function spdMinimoZone(st: Struttura, zone: Zona[], lps: ClasseLps): ClasseLps | null {
  for (const l of ["nessuno", "IV", "III", "II", "I"] as ClasseLps[]) if (calcolaZone(st, zone, { lps, spd: l }).frequenzaConforme) return l;
  return null;
}

/** Struttura a zona unica dai dati semplici (compatibilità con la prima versione). */
export function zonaUnica(d: DatiRischio): { st: Struttura; zona: Zona } {
  const rfId = d.rfId ?? RISCHIO_INCENDIO.find((x) => x.valore === d.rf && !x.id.startsWith("esplosione-"))?.id ?? "ordinario";
  const st: Struttura = { L: d.L, W: d.W, H: d.H, NG: d.NG, CD: d.CD, k: d.k ?? 2, Uw: d.Uw ?? 2.5, PS: d.PS ?? 1, danniMateriali: d.danniMateriali !== false, linee: d.linee };
  const zona: Zona = { id: "z1", nome: "Struttura", oreAnno: d.frazionePresenza * 8760, rt: d.rt, rp: d.rp, rfId, categoria: categoriaDi(d).id, misureContatto: d.misureContatto, esterna: true, esposti: false, impiantiCritici: d.impiantiCritici, serviziCritici: !!d.serviziCritici };
  return { st, zona };
}

export function calcolaR1(d: DatiRischio, p: Protezione): EsitoRischio {
  const { st, zona } = zonaUnica(d);
  const e = calcolaZone(st, [zona], p);
  const z = e.zone[0]!;
  const { RAD: _rad, ...componenti } = z.componenti; void _rad;
  return { NSG: e.NSG, ND: e.ND, NM: e.NM, NL: e.NL, NI: e.NI, AD: e.AD, AM: e.AM, componenti, RL1: z.RL1, RL2: z.RL2, R1: z.R, conforme: z.conforme, frequenze: z.frequenze, F: z.F, FT: z.FT, frequenzaConforme: z.frequenzaConforme };
}

const ORDINE: ClasseLps[] = ["nessuno", "IV", "III", "II", "I"];

/**
 * Protezione minima per il rischio R: prima senza nulla, poi LPS + SPD dello stesso livello dal IV al I.
 * Restituisce la prima combinazione con R ≤ RT, oppure null se nemmeno il livello I basta.
 */
export function protezioneMinima(d: DatiRischio): { protezione: Protezione; esito: EsitoRischio } | null {
  for (const l of ORDINE) {
    const protezione = { lps: l, spd: l };
    const esito = calcolaR1(d, protezione);
    if (esito.conforme) return { protezione, esito };
  }
  return null;
}

/** SPD minimo per la frequenza del danno F ≤ FT, con l'LPS scelto. */
export function spdMinimoFrequenza(d: DatiRischio, lps: ClasseLps): ClasseLps | null {
  for (const l of ORDINE) if (calcolaR1(d, { lps, spd: l }).frequenzaConforme) return l;
  return null;
}
