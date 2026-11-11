/**
 * Analisi del rischio di perdita di vite umane R1 (CEI EN IEC 62305-2), struttura a zona unica.
 *   R1 = RA + RB + RU + RV  (+ RC + RM + RW + RZ per strutture con rischio di esplosione,
 *        ospedali o dove guasti degli impianti interni mettono subito in pericolo la vita)
 * Fulmini sulla struttura (ND), vicino (NM), sulle linee (NL) e vicino alle linee (NI).
 * Probabilità P e perdite L con i valori tipici delle tabelle della norma: tutti modificabili
 * e da verificare con l'edizione 2024 (che ha rivisto parte dell'impostazione).
 */
import { areaRaccolta } from "./areaRaccolta";

export type Livello = "I" | "II" | "III" | "IV";
export type ClasseLps = "nessuno" | Livello;

export interface Opzione { id: string; nome: string; valore: number }
const o = (id: string, nome: string, valore: number): Opzione => ({ id, nome, valore });

export const RT_R1 = 1e-5;

/** PB: probabilità di danno fisico per fulmine sulla struttura, in funzione della classe dell'LPS. */
export const PB: Record<ClasseLps, number> = { nessuno: 1, IV: 0.2, III: 0.1, II: 0.05, I: 0.02 };
/** PEB: probabilità ridotta dal collegamento equipotenziale con SPD per LPL. */
export const PEB: Record<ClasseLps, number> = { nessuno: 1, IV: 0.05, III: 0.05, II: 0.02, I: 0.01 };
/** PSPD: sistema di SPD coordinati per LPL. */
export const PSPD: Record<ClasseLps, number> = { nessuno: 1, IV: 0.05, III: 0.05, II: 0.02, I: 0.01 };

export const MISURE_CONTATTO: Opzione[] = [o("nessuna", "Nessuna misura", 1), o("cartelli", "Cartelli di avvertimento", 0.1), o("isolamento", "Isolamento elettrico delle parti accessibili", 0.01), o("equipotenziale", "Equipotenzializzazione del suolo", 0.01), o("barriere", "Restrizioni fisiche / calate naturali nel cemento armato", 0)];
export const POSA_LINEA: Opzione[] = [o("aerea", "Aerea", 1), o("interrata", "Interrata", 0.5), o("interrata-maglia", "Interrata in area con dispersore a maglia", 0.01)];
export const AMBIENTE_LINEA: Opzione[] = [o("rurale", "Rurale", 1), o("suburbano", "Suburbano", 0.5), o("urbano", "Urbano", 0.1), o("urbano-alto", "Urbano con edifici alti (> 20 m)", 0.01)];
export const TIPO_LINEA: Opzione[] = [o("bt", "Bassa tensione, telecomunicazioni, dati", 1), o("mt", "Media/alta tensione con trasformatore", 0.2)];
export const PAVIMENTO: Opzione[] = [o("terra", "Agricolo, calcestruzzo", 1e-2), o("marmo", "Marmo, ceramica", 1e-3), o("ghiaia", "Ghiaia, moquette, tappeti", 1e-4), o("asfalto", "Asfalto, linoleum, legno", 1e-5)];
export const RISCHIO_INCENDIO: Opzione[] = [o("esplosione", "Rischio di esplosione (zone 0/20)", 1), o("alto", "Alto", 1e-1), o("ordinario", "Ordinario", 1e-2), o("ridotto", "Ridotto", 1e-3), o("nessuno", "Nessuno", 0)];
export const PROTEZIONE_INCENDIO: Opzione[] = [o("nessuna", "Nessuna", 1), o("manuale", "Estintori, idranti, allarme manuale, compartimentazione", 0.5), o("automatica", "Impianto automatico di spegnimento o allarme", 0.2)];
export const PERICOLO_SPECIALE: Opzione[] = [o("nessuno", "Nessun pericolo particolare", 1), o("panico-basso", "Panico basso (≤ 2 piani, < 100 persone)", 2), o("panico-medio", "Panico medio (100–1000 persone)", 5), o("evacuazione", "Evacuazione difficile (persone non autonome, ospedali)", 5), o("panico-alto", "Panico alto (> 1000 persone)", 10)];
export const DESTINAZIONE: Opzione[] = [o("esplosione", "Rischio di esplosione", 1e-1), o("ospedale", "Ospedale, albergo, scuola, edificio civile", 1e-1), o("pubblico", "Spettacolo pubblico, chiesa, museo", 5e-2), o("industriale", "Industriale, commerciale", 2e-2), o("altro", "Altro (abitazione, ufficio…)", 1e-2)];
export const LT = 1e-2;
export const LO_SPECIALE = 1e-2; // perdita per guasto degli impianti interni (ospedali, esplosione)

export interface Linea { nome: string; lunghezza: number; posa: number; ambiente: number; tipo: number; schermata: boolean }

export interface DatiRischio {
  L: number; W: number; H: number;
  NG: number; CD: number;
  linee: Linea[];
  rt: number; LF: number; rp: number; rf: number; hz: number;
  misureContatto: number;
  impiantiCritici: boolean;
  /** persone nella zona / totale e ore di presenza all'anno (frazione della perdita) */
  frazionePresenza: number;
}

export interface Protezione { lps: ClasseLps; spd: ClasseLps }

export interface Componenti { RA: number; RB: number; RC: number; RM: number; RU: number; RV: number; RW: number; RZ: number }
export interface EsitoRischio { ND: number; NM: number; NL: number; NI: number; AD: number; AM: number; componenti: Componenti; R1: number; conforme: boolean }

export function areaVicinanze(L: number, W: number): number {
  return 2 * 500 * (L + W) + Math.PI * 500 * 500;
}

export function calcolaR1(d: DatiRischio, p: Protezione): EsitoRischio {
  const AD = areaRaccolta(d.L, d.W, d.H);
  const AM = areaVicinanze(d.L, d.W);
  const ND = d.NG * AD * d.CD * 1e-6;
  const NM = d.NG * AM * 1e-6;
  let NL = 0, NI = 0;
  const pb = PB[p.lps];
  const peb = PEB[p.spd];
  const pspd = PSPD[p.spd];
  let RU = 0, RV = 0, RW = 0, RZ = 0;
  const f = d.frazionePresenza;
  const LA = d.rt * LT * f, LU = d.rt * LT * f;
  const LB = d.rp * d.rf * d.hz * d.LF * f, LV = LB;
  const LC = d.impiantiCritici ? LO_SPECIALE * f : 0;
  for (const linea of d.linee) {
    const AL = 40 * linea.lunghezza, AI = 4000 * linea.lunghezza;
    const nl = d.NG * AL * linea.posa * linea.ambiente * linea.tipo * 1e-6;
    const ni = d.NG * AI * linea.posa * linea.ambiente * linea.tipo * 1e-6;
    NL += nl; NI += ni;
    const PLD = linea.schermata ? 0.2 : 1;
    const PLI = linea.schermata ? 0.3 : 1;
    RU += nl * (d.misureContatto * peb * PLD) * LU;
    RV += nl * (peb * PLD) * LV;
    if (d.impiantiCritici) { RW += nl * (pspd * PLD) * LC; RZ += ni * (pspd * PLI) * LC; }
  }
  const RA = ND * (d.misureContatto * pb) * LA;
  const RB = ND * pb * LB;
  const RC = d.impiantiCritici ? ND * pspd * LC : 0;
  const RM = d.impiantiCritici ? NM * pspd * 1 * LC : 0;
  const componenti = { RA, RB, RC, RM, RU, RV, RW, RZ };
  const R1 = Object.values(componenti).reduce((a, b) => a + b, 0);
  return { ND, NM, NL, NI, AD, AM, componenti, R1, conforme: R1 <= RT_R1 };
}

const ORDINE: ClasseLps[] = ["nessuno", "IV", "III", "II", "I"];

/**
 * Protezione minima: prima senza nulla, poi LPS + SPD dello stesso livello dal IV al I.
 * Restituisce la prima combinazione con R1 ≤ RT, oppure null se nemmeno il livello I basta.
 */
export function protezioneMinima(d: DatiRischio): { protezione: Protezione; esito: EsitoRischio } | null {
  for (const l of ORDINE) {
    const protezione = { lps: l, spd: l };
    const esito = calcolaR1(d, protezione);
    if (esito.conforme) return { protezione, esito };
  }
  return null;
}
