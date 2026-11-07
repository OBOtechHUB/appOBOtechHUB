/**
 * Resistenza di terra dei dispersori (calcolo di stima, da confermare con misura).
 *
 * Formule analitiche classiche in terreno omogeneo di resistività ρ (Ω·m):
 *  - picchetto verticale (Dwight):                R = ρ/(2πL) · (ln(8L/d) − 1)
 *  - conduttore orizzontale interrato (Sunde):     R = ρ/(πL) · (ln(2L/√(d·h)) − 1)
 *    (anello e dispersore di fondazione come conduttore chiuso di lunghezza pari al perimetro;
 *     per il piatto si usa il diametro equivalente d = larghezza/2)
 *  - maglia (Laurent-Niemann semplificata):        R = ρ/4 · √(π/A) + ρ/Ltot
 *  - resistività dalla misura Wenner:              ρ = 2π·a·R
 * Formule pratiche di confronto (EN 50522, allegato J): picchetto ≈ ρ/L, orizzontale ≈ 2ρ/L,
 * anello ≈ 2ρ/(3D), maglia ≈ ρ/(2D).
 * CEI EN IEC 62305-3 raccomanda, quando possibile, una resistenza bassa (indicativamente < 10 Ω).
 */

export const OBIETTIVO_RACCOMANDATO = 10; // Ω

export interface TerrenoTipico { nome: string; rho: number; intervallo: string }
/** Valori indicativi di resistività: vanno sempre preferiti i valori misurati. */
export const TERRENI_TIPICI: TerrenoTipico[] = [
  { nome: "Terreno paludoso", rho: 30, intervallo: "5–40" },
  { nome: "Argilla, limo, humus", rho: 100, intervallo: "20–200" },
  { nome: "Sabbia umida", rho: 200, intervallo: "200–2500" },
  { nome: "Ghiaia umida", rho: 500, intervallo: "50–3000" },
  { nome: "Sabbia o ghiaia secca", rho: 1000, intervallo: "fino a 3000" },
  { nome: "Terreno sassoso / roccia", rho: 3000, intervallo: "1500–10000" },
];

const positivo = (v: number, nome: string) => {
  if (!Number.isFinite(v) || v <= 0) throw new Error(`${nome} deve essere un numero positivo.`);
};

/** Picchetto verticale di lunghezza L (m) e diametro d (m). */
export function resistenzaPicchetto(rho: number, L: number, d = 0.02): number {
  positivo(rho, "ρ"); positivo(L, "L"); positivo(d, "d");
  return (rho / (2 * Math.PI * L)) * (Math.log((8 * L) / d) - 1);
}

/** Conduttore orizzontale (o chiuso ad anello) di lunghezza L (m), diametro d (m), profondità h (m). */
export function resistenzaOrizzontale(rho: number, L: number, d = 0.01, h = 0.5): number {
  positivo(rho, "ρ"); positivo(L, "L"); positivo(d, "d"); positivo(h, "h");
  return Math.max(0, (rho / (Math.PI * L)) * (Math.log((2 * L) / Math.sqrt(d * h)) - 1));
}

/** Diametro equivalente di un piatto di larghezza w (m). */
export function diametroEquivalentePiatto(w: number): number {
  positivo(w, "larghezza");
  return w / 2;
}

/** Maglia di area A (m²) con lunghezza totale di conduttore Ltot (m). */
export function resistenzaMaglia(rho: number, A: number, Ltot: number): number {
  positivo(rho, "ρ"); positivo(A, "A"); positivo(Ltot, "Ltot");
  return (rho / 4) * Math.sqrt(Math.PI / A) + rho / Ltot;
}

/** Resistività apparente dalla misura con il metodo di Wenner: distanza tra i picchetti a (m), resistenza letta R (Ω). */
export function resistivitaWenner(a: number, R: number): number {
  positivo(a, "a"); positivo(R, "R");
  return 2 * Math.PI * a * R;
}

/**
 * Elementi in parallelo con coefficiente di utilizzo η (0–1] per l'influenza reciproca:
 * R = 1 / (η · Σ 1/Ri). Con η = 1 il risultato è il parallelo ideale (ottimistico).
 */
export function resistenzaParallelo(resistenze: number[], eta = 1): number {
  if (!(eta > 0 && eta <= 1)) throw new Error("Il coefficiente di utilizzo deve essere tra 0 e 1.");
  const valide = resistenze.filter((r) => Number.isFinite(r) && r > 0);
  if (!valide.length) return Number.NaN;
  return 1 / (eta * valide.reduce((s, r) => s + 1 / r, 0));
}

/** Formule pratiche di confronto (EN 50522, allegato J). */
export const pratiche = {
  picchetto: (rho: number, L: number) => rho / L,
  orizzontale: (rho: number, L: number) => (2 * rho) / L,
  anello: (rho: number, D: number) => (2 * rho) / (3 * D),
  maglia: (rho: number, D: number) => rho / (2 * D),
};

export interface ElementiDispersore {
  /** metri di dispersore orizzontale/anello/fondazione (conduttore chiuso o aperto) */
  metriOrizzontali: number;
  /** larghezza del piatto (m) o null se tondo */
  larghezzaPiatto: number | null;
  /** diametro del tondo (m) se non è un piatto */
  diametroTondo: number;
  profondita: number;
  picchetti: { lunghezza: number; diametro?: number | undefined }[];
}

export interface StimaImpianto {
  rOrizzontale: number | null;
  rPicchetti: number | null;
  rTotale: number;
  conforme: boolean;
  dettaglio: string[];
}

/** Stima la resistenza di un impianto composto da conduttore orizzontale/anello più picchetti. */
export function stimaImpianto(rho: number, e: ElementiDispersore, eta = 0.8): StimaImpianto {
  positivo(rho, "ρ");
  const dettaglio: string[] = [];
  const d = e.larghezzaPiatto ? diametroEquivalentePiatto(e.larghezzaPiatto) : e.diametroTondo;
  const rOrizzontale = e.metriOrizzontali > 0 ? resistenzaOrizzontale(rho, e.metriOrizzontali, d, e.profondita) : null;
  if (rOrizzontale !== null) dettaglio.push(`Conduttore interrato ${e.metriOrizzontali.toFixed(1)} m: ${rOrizzontale.toFixed(2)} Ω`);
  const rp = e.picchetti.map((p) => resistenzaPicchetto(rho, p.lunghezza, p.diametro ?? 0.02));
  const rPicchetti = rp.length ? resistenzaParallelo(rp, eta) : null;
  if (rPicchetti !== null) dettaglio.push(`${rp.length} picchetti in parallelo (η = ${eta}): ${rPicchetti.toFixed(2)} Ω`);
  const parti = [rOrizzontale, rPicchetti].filter((r): r is number => r !== null);
  const rTotale = parti.length > 1 ? resistenzaParallelo(parti, eta) : (parti[0] ?? Number.NaN);
  if (parti.length > 1) dettaglio.push(`Conduttore e picchetti in parallelo (η = ${eta}): ${rTotale.toFixed(2)} Ω`);
  return { rOrizzontale, rPicchetti, rTotale, conforme: rTotale <= OBIETTIVO_RACCOMANDATO, dettaglio };
}
