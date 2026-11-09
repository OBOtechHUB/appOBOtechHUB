/**
 * Calate e distanza di separazione (CEI EN IEC 62305-3).
 *   s = ki · kc / km · l
 * ki dipende dall'LPL, km dal materiale isolante, kc dalla ripartizione della corrente tra le calate,
 * l è la lunghezza lungo l'LPS dal punto considerato al più vicino collegamento equipotenziale.
 * Valori della CEI EN IEC 62305-3:2024: ki Tab. 11, km Tab. 12, kc Tab. 13 e Allegato B,
 * distanza tra le calate Tab. 5.
 */
import distanze from "@/dati/calate/distanzaCalate.json";

export type Livello = "I" | "II" | "III" | "IV";
export type Materiale = "aria" | "solido" | "frp";

export const KI: Record<Livello, number> = { I: 0.08, II: 0.06, III: 0.04, IV: 0.04 };
export const KM: Record<Materiale, number> = { aria: 1, solido: 0.5, frp: 0.7 };
export const NOMI_MATERIALE: Record<Materiale, string> = { aria: "Aria", solido: "Calcestruzzo, mattoni, legno", frp: "Distanziatore isolante FRP, PE o PVC (lungo almeno 0,5 m)" };

/** Distanza tipica tra le calate (m) per LPL. */
export function passoCalate(lpl: Livello): number {
  return (distanze as Record<Livello, { distanzaTipica: number }>)[lpl].distanzaTipica;
}

/** Numero di calate: perimetro / passo tipico, almeno 2. */
export function numeroCalate(perimetro: number, lpl: Livello): number {
  if (!(perimetro > 0)) return 0;
  return Math.max(2, Math.ceil(perimetro / passoCalate(lpl) - 1e-9));
}

/** kc semplificato (Tab. 13): 1 calata (solo LPS isolato) → 1; 2 calate → 0,66; 3 o più → 0,44.
 *  Vale per dispersori di tipo B e di tipo A con resistenze simili (entro un fattore 2), altrimenti kc = 1. */
export function kcSemplificato(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 0.66;
  return 0.44;
}

/**
 * kc dettagliato per dispersore di tipo B (anello) o fondazione:
 *   kc = 1/(2n) + 0,1 + 0,2 · (c/h)^(1/3)   (limitato tra 1/n e 1)
 * n numero calate, c distanza tra le calate (m), h altezza (m) dal piano dell'anello equipotenziale.
 */
export function kcDettagliato(n: number, c: number, h: number): number {
  if (!(n >= 1) || !(c > 0) || !(h > 0)) throw new Error("n, c e h devono essere positivi.");
  const k = 1 / (2 * n) + 0.1 + 0.2 * Math.cbrt(c / h);
  return Math.min(1, Math.max(1 / n, k));
}

export function distanzaSeparazione(ki: number, kc: number, km: number, l: number): number {
  if (![ki, kc, km, l].every((v) => Number.isFinite(v) && v >= 0) || km === 0) throw new Error("Coefficienti non validi.");
  return (ki * kc / km) * l;
}

export interface PuntoCritico { id: string; descrizione: string; l: number; d: number; materiale: Materiale }
export interface EsitoPunto extends PuntoCritico { s: number; conforme: boolean; margine: number }

export function verificaPunti(punti: PuntoCritico[], ki: number, kc: number, km: Record<Materiale, number> = KM): EsitoPunto[] {
  return punti.map((p) => {
    const s = distanzaSeparazione(ki, kc, km[p.materiale], p.l);
    return { ...p, s, conforme: p.d >= s, margine: p.d - s };
  });
}

/** Perimetro dell'impronta (poligono chiuso) in m. */
export function perimetro(impronta: [number, number][]): number {
  if (impronta.length < 2) return 0;
  return impronta.reduce((t, p, i) => { const q = impronta[(i + 1) % impronta.length]!; return t + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
}
