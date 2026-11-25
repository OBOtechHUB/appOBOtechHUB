/**
 * Conduttore isolato OBO isCon (calate isolate ad alta tensione).
 * Ogni versione ha una distanza di separazione equivalente: il conduttore sostituisce una distanza in aria pari a
 * sEq (in materiale solido il doppio). La verifica è s richiesta (s = ki · kc / km · l, CEI EN IEC 62305-3) ≤ sEq.
 * Valori dalle sigle e dai dati OBO (BA 45 = 0,45 m, Pro/Pro+ 75 = 0,75 m, PR 90 = 0,90 m in aria):
 * DA CONFERMARE con la scheda tecnica e la norma che Marco invierà; sono qui in un solo posto per aggiornarli.
 */
export type VersioneIscon = "basic" | "pro" | "proplus" | "premium";

export interface DatiIscon { nome: string; sigla: string; sAria: number; sSolido: number; codici: { codice: string; colore: string }[] }

export const ISCON: Record<VersioneIscon, DatiIscon> = {
  basic: { nome: "isCon Basic", sigla: "BA 45", sAria: 0.45, sSolido: 0.9, codici: [{ codice: "5408014", colore: "nero" }] },
  pro: { nome: "isCon Professional", sigla: "Pro 75", sAria: 0.75, sSolido: 1.5, codici: [{ codice: "5408008", colore: "nero" }] },
  proplus: { nome: "isCon Professional plus", sigla: "Pro+ 75", sAria: 0.75, sSolido: 1.5, codici: [{ codice: "5408002", colore: "nero" }, { codice: "5407995", colore: "grigio chiaro" }] },
  premium: { nome: "isCon Premium", sigla: "PR 90", sAria: 0.9, sSolido: 1.8, codici: [{ codice: "5408018", colore: "nero" }] },
};
export const ORDINE_ISCON: VersioneIscon[] = ["basic", "pro", "proplus", "premium"];
/** Accessori del sistema presenti nel catalogo OBO dell'app. */
export const ACCESSORI_ISCON = [
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
/** La versione più semplice che basta (Pro+ preferita a Pro a parità di sEq), o null se nessuna basta. */
export function versioneMinima(sRichiesta: number, materiale: "aria" | "solido" = "aria"): VersioneIscon | null {
  for (const v of ["basic", "proplus", "premium"] as VersioneIscon[]) if (verificaIscon(v, sRichiesta, materiale).conforme) return v;
  return null;
}
/** Lunghezza massima l del conduttore (m) dal punto più alto al collegamento equipotenziale con quella versione. */
export function lunghezzaMassima(v: VersioneIscon, ki: number, kc: number, km = 1): number {
  return ki * kc > 0 ? sEquivalente(v, km < 1 ? "solido" : "aria") * km / (ki * kc) : Infinity;
}
