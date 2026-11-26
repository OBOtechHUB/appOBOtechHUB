/**
 * Conduttore isolato OBO isCon (calate isolate ad alta tensione), nuova generazione 2018.
 * Ogni versione ha una distanza di separazione equivalente se: il conduttore sostituisce una distanza in aria pari a
 * se (nel materiale solido il doppio). La verifica è s richiesta (s = ki · kc / km · l, CEI EN IEC 62305-3) ≤ se.
 * Fonti (26/11/2026, documenti OBO mandati da Marco): certificati OBO BET 02-250_ZG-BET (isCon Pro 75 SW, Pro+ 75 SW,
 * Pro+ 75 GR, Premium 90 SW, 2018, prova secondo IEC TS 62561-8), presentazione «isCon System – New Generation»
 * (dati tecnici, lunghezze massime, guida alla scelta, posa), istruzioni isCon HM SET 5408090 (10/2026).
 */
export type VersioneIscon = "basic" | "pro" | "proplus" | "premium";
export type ClasseIscon = "H1" | "H2";

export interface DatiIscon {
  nome: string; sigla: string; sAria: number; sSolido: number;
  codici: { codice: string; colore: string; nota?: string }[];
  /** diametro esterno (mm) per colore (nero / grigio chiaro) */
  diametro: { nero: number; grigio?: number };
  /** raggio minimo di curvatura (mm) */
  raggioCurvatura: { nero: number; grigio?: number };
  /** classe di corrente di fulmine secondo IEC TS 62561-8: H1 = 150 kA, H2 = 200 kA (10/350 µs) */
  classe: ClasseIscon; iimp: number;
  /** lunghezza della zona di controllo del potenziale x (m) vicino al collegamento: in quel tratto, entro s, niente parti conduttrici */
  zonaPotenziale: number;
  /** collegamento equipotenziale del rivestimento al palo / all'altro capo del conduttore */
  equipotenziale: { palo: boolean; altroCapo: boolean; nota: string };
  verniciabile: boolean; atex: boolean; protezioneMeccanica: boolean;
}

export const ISCON: Record<VersioneIscon, DatiIscon> = {
  basic: { nome: "isCon Basic 45", sigla: "Basic 45 SW", sAria: 0.45, sSolido: 0.9, codici: [{ codice: "5408014", colore: "nero" }],
    diametro: { nero: 20 }, raggioCurvatura: { nero: 200 }, classe: "H1", iimp: 150, zonaPotenziale: 0.9,
    equipotenziale: { palo: false, altroCapo: false, nota: "Nessun collegamento equipotenziale al palo (il morsetto PAE interno al palo va comunque montato). Dall'altra parte: morsetto PAE oppure, in alternativa, distanza x = 0,90 m tra elemento di collegamento e ultimo distanziatore isolato." },
    verniciabile: false, atex: false, protezioneMeccanica: false },
  pro: { nome: "isCon Pro 75", sigla: "Pro 75 SW", sAria: 0.75, sSolido: 1.5, codici: [{ codice: "5408008", colore: "nero" }],
    diametro: { nero: 20 }, raggioCurvatura: { nero: 200 }, classe: "H1", iimp: 150, zonaPotenziale: 1.5,
    equipotenziale: { palo: true, altroCapo: true, nota: "Collegamento equipotenziale al palo (morsetto PAE interno) e all'altro capo; tratto x = 1,50 m su entrambi i lati senza parti conduttrici entro s." },
    verniciabile: false, atex: false, protezioneMeccanica: false },
  proplus: { nome: "isCon Pro+ 75", sigla: "Pro+ 75 SW / GR", sAria: 0.75, sSolido: 1.5,
    codici: [{ codice: "5408002", colore: "nero" }, { codice: "5408004", colore: "nero" }, { codice: "5408006", colore: "nero" },
      { codice: "5407995", colore: "grigio chiaro", nota: "protezione dalle tensioni di contatto" }, { codice: "5407997", colore: "grigio chiaro", nota: "protezione dalle tensioni di contatto" }],
    diametro: { nero: 23, grigio: 26 }, raggioCurvatura: { nero: 230, grigio: 260 }, classe: "H1", iimp: 150, zonaPotenziale: 1.5,
    equipotenziale: { palo: true, altroCapo: true, nota: "Come Pro 75. La guaina esterna può essere danneggiata (resta ≥ 0,2 mm su tutto il perimetro, tagli < 1,3 mm) senza perdere l'isolamento." },
    verniciabile: true, atex: true, protezioneMeccanica: true },
  premium: { nome: "isCon Premium 90", sigla: "Premium 90 SW", sAria: 0.9, sSolido: 1.8, codici: [{ codice: "5408018", colore: "nero" }],
    diametro: { nero: 23 }, raggioCurvatura: { nero: 230 }, classe: "H2", iimp: 200, zonaPotenziale: 1.5,
    equipotenziale: { palo: true, altroCapo: true, nota: "Collegamento equipotenziale al palo (morsetto PAE interno) e all'altro capo; tratto x = 1,50 m su entrambi i lati senza parti conduttrici entro s." },
    verniciabile: false, atex: false, protezioneMeccanica: false },
};
/** Dati comuni a tutte le versioni (presentazione OBO). */
export const ISCON_COMUNE = { sezione: 35, trazioneMax: 1750, temperaturaEsercizio: "−30 … +70 °C", temperaturaPosa: "−5 … +40 °C", norma: "IEC TS 62561-8:2018" };
/** Pro+ 75 GR (grigio): protezione dalle tensioni di contatto (100 kV 1,2/50 µs sotto pioggia, CEI EN IEC 62305-3): al massimo 5 m, guaina collegata al supporto metallico isCon H VA dopo 0,5 m dal collegamento superiore. */
export const ISCON_GR_CONTATTO = { lunghezzaMax: 5, collegamentoGuaina: 0.5 };
export const ORDINE_ISCON: VersioneIscon[] = ["basic", "pro", "proplus", "premium"];
/** Accessori del sistema presenti nel catalogo OBO dell'app. */
export const ACCESSORI_ISCON = [
  { codice: "5408090", descrizione: "isCon HM SET: set di supporti per fissare fino a 4 conduttori isCon al palo di captazione (pali 4/6/8/10 m)" },
  { codice: "5408094", descrizione: "isCon HM ERW: estensione con 2 supporti e 8 coperchi, per pali oltre 6 m" },
  { codice: "5408026", descrizione: "Piastra di collegamento per un conduttore isCon" },
  { codice: "5408028", descrizione: "Piastra di collegamento per due conduttori isCon" },
  { codice: "5408058", descrizione: "Cartello informativo isCon" },
];

/** sEq della versione nel materiale indicato ("solido" = calcestruzzo, mattoni, legno). */
export function sEquivalente(v: VersioneIscon, materiale: "aria" | "solido" = "aria"): number {
  return materiale === "solido" ? ISCON[v].sSolido : ISCON[v].sAria;
}

export interface EsitoIscon { versione: VersioneIscon; sRichiesta: number; sEq: number; conforme: boolean; margine: number }
export function verificaIscon(v: VersioneIscon, sRichiesta: number, materiale: "aria" | "solido" = "aria"): EsitoIscon {
  const sEq = sEquivalente(v, materiale);
  return { versione: v, sRichiesta, sEq, conforme: sRichiesta <= sEq + 1e-9, margine: sEq - sRichiesta };
}
/**
 * Corrente di fulmine che il conduttore deve portare: con LPL I e una sola calata isolata serve la classe H2 (200 kA),
 * cioè solo Premium 90; con 2 o più calate la corrente si divide e basta H1 (tabella delle lunghezze massime OBO).
 */
export function ammessaPerCorrente(v: VersioneIscon, lpl?: string, nCalate = 2): boolean {
  return !(lpl === "I" && nCalate <= 1 && ISCON[v].classe !== "H2");
}
/** La versione più semplice che basta (Pro+ preferita a Pro a parità di se), o null se nessuna basta. */
export function versioneMinima(sRichiesta: number, materiale: "aria" | "solido" = "aria", lpl?: string, nCalate = 2): VersioneIscon | null {
  for (const v of ["basic", "proplus", "premium"] as VersioneIscon[]) if (ammessaPerCorrente(v, lpl, nCalate) && verificaIscon(v, sRichiesta, materiale).conforme) return v;
  return null;
}

/** Guida alla scelta OBO (Selection Aid): dalle esigenze del punto di posa alla versione e al colore. */
export interface EsigenzeIscon { sAria: number; verniciabile?: boolean; atex?: boolean; protezioneMeccanica?: boolean; tensioniContatto?: boolean }
export function scegliIscon(e: EsigenzeIscon): { versione: VersioneIscon; colore: "nero" | "grigio chiaro"; codice: string; motivo: string } | null {
  if (e.sAria > 0.9 + 1e-9) return null;
  if (e.sAria > 0.75 + 1e-9) return { versione: "premium", colore: "nero", codice: "5408018", motivo: "s in aria oltre 0,75 m" };
  if (e.verniciabile || e.atex || e.protezioneMeccanica || e.tensioniContatto) {
    const gr = !!e.tensioniContatto;
    const motivi = [e.verniciabile && "verniciabile", e.atex && "zona ATEX", e.protezioneMeccanica && "protezione meccanica", e.tensioniContatto && "protezione dalle tensioni di contatto"].filter(Boolean).join(", ");
    return { versione: "proplus", colore: gr ? "grigio chiaro" : "nero", codice: gr ? "5407995" : "5408002", motivo: motivi };
  }
  if (e.sAria <= 0.45 + 1e-9) return { versione: "basic", colore: "nero", codice: "5408014", motivo: "s in aria fino a 0,45 m" };
  return { versione: "pro", colore: "nero", codice: "5408008", motivo: "s in aria fino a 0,75 m" };
}
/** Lunghezza massima l del conduttore (m) dal punto più alto al collegamento equipotenziale con quella versione
 * (come la tabella OBO: es. LPL II, 1 calata, Pro 75 → 12,50 m; 2 calate → 18,94 m; ≥ 3 → 28,41 m). */
export function lunghezzaMassima(v: VersioneIscon, ki: number, kc: number, km = 1): number {
  return ki * kc > 0 ? sEquivalente(v, km < 1 ? "solido" : "aria") * km / (ki * kc) : Infinity;
}
