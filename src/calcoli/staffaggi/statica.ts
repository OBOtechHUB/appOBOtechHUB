/**
 * Statica semplice per gli staffaggi: travi appoggiate (traversi), mensole (sbalzi), aste tese o compresse.
 * Si usano per prime le tabelle OBO dei carichi ammessi (interpolate sulla luce); dove la tabella non c'è
 * si calcola con i valori statici del profilo (Wy, Iy) con tensione ammessa e freccia limite dichiarate.
 * Unità: luci in mm, carichi in kN e kN/m, Wy in cm³, Iy in cm⁴. Logica pura.
 */
export const G = 9.81 / 1000; // kN per kg
export const E_ACCIAIO = 210000; // N/mm²
/** tensione ammessa per i calcoli senza tabella (acciaio S250GD con coefficiente 1,5) */
export const SIGMA_AMM = 160; // N/mm²
/** freccia limite dei traversi senza tabella */
export const FRECCIA_LIMITE = 200; // L/200

export interface TabellaCarichi { L: number[]; Fzul?: (number | null)[] | undefined; qzul?: (number | null)[] | undefined }
export interface Statica { A?: number | undefined; Iy: number; Iz?: number | undefined; Wy: number; Wz?: number | undefined }

/** Interpolazione lineare in una tabella crescente; null fuori tabella (non si estrapola) o se manca il dato. */
export function interpola(xs: number[], ys: (number | null)[] | undefined, x: number): number | null {
  if (!ys || !xs.length) return null;
  if (x < xs[0]! - 1e-9) {
    // luci più corte della prima: vale il valore della prima luce (a favore di sicurezza: il carico non cresce)
    return ys[0] ?? null;
  }
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i]!, b = xs[i + 1]!;
    if (x >= a - 1e-9 && x <= b + 1e-9) {
      const ya = ys[i], yb = ys[i + 1];
      if (ya == null || yb == null) return null;
      return ya + ((yb - ya) * (x - a)) / (b - a || 1);
    }
  }
  return Math.abs(x - xs[xs.length - 1]!) < 1e-9 ? ys[xs.length - 1] ?? null : null;
}

/** Carico distribuito ammesso (kN/m) su trave appoggiata di luce L (mm) con i valori statici. */
export function qAmmessoStatica(s: Statica, L: number): number {
  const W = s.Wy * 1000, I = s.Iy * 1e4; // mm³, mm⁴
  const qMomento = (8 * SIGMA_AMM * W) / (L * L); // N/mm = kN/m
  const qFreccia = (384 * E_ACCIAIO * I) / (5 * L * L * L * FRECCIA_LIMITE);
  return Math.min(qMomento, qFreccia);
}
/** Carico concentrato in mezzeria ammesso (kN) con i valori statici. */
export function FAmmessoStatica(s: Statica, L: number): number {
  const W = s.Wy * 1000, I = s.Iy * 1e4;
  const fMomento = (4 * SIGMA_AMM * W) / L / 1000; // kN
  const fFreccia = (48 * E_ACCIAIO * I) / (L * L * FRECCIA_LIMITE) / 1000;
  return Math.min(fMomento, fFreccia);
}

export type Esito = "ok" | "ko" | "nd";
export interface Verifica {
  elemento: string;
  /** cosa si verifica, es. "carico distribuito sul traverso" */
  grandezza: string;
  valore: number;
  ammesso: number | null;
  unita: string;
  esito: Esito;
  /** sfruttamento valore / ammesso (0-1+), null se non verificabile */
  sfruttamento: number | null;
  fonte: string;
  nota?: string | undefined;
}
export function verifica(elemento: string, grandezza: string, valore: number, ammesso: number | null, unita: string, fonte: string, nota?: string): Verifica {
  const sfr = ammesso && ammesso > 0 ? valore / ammesso : null;
  return { elemento, grandezza, valore, ammesso, unita, esito: ammesso == null ? "nd" : valore <= ammesso + 1e-9 ? "ok" : "ko", sfruttamento: sfr, fonte, ...(nota ? { nota } : {}) };
}

/**
 * Traverso appoggiato agli estremi (pendini, montanti) con carico distribuito su una larghezza b centrata.
 * Si confronta con la tabella qzul come se il carico fosse distribuito su tutta la luce con la stessa risultante
 * aumentata del rapporto luce/b (a favore di sicurezza: stesso momento massimo o maggiore).
 */
export function verificaTraverso(nome: string, tab: TabellaCarichi | null, s: Statica | null, luce: number, larghezzaCarico: number, F: number): Verifica {
  const b = Math.min(larghezzaCarico, luce);
  // momento massimo con carico F su larghezza b centrata: M = F/4 (L - b/2); carico uniforme equivalente su L: q = 8M/L²
  const M = (F / 4) * (luce - b / 2) / 1000; // kNm
  const qEq = (8 * M) / ((luce / 1000) ** 2); // kN/m
  const daTab = tab ? interpola(tab.L, tab.qzul, luce) : null;
  if (daTab != null) return verifica(nome, `carico uniforme equivalente sul traverso (luce ${luce} mm)`, qEq, daTab, "kN/m", "tabella OBO qzul");
  if (s) return verifica(nome, `carico uniforme equivalente sul traverso (luce ${luce} mm)`, qEq, qAmmessoStatica(s, luce), "kN/m", `calcolo con Wy e Iy (σ amm ${SIGMA_AMM} N/mm², freccia L/${FRECCIA_LIMITE})`);
  return verifica(nome, `carico uniforme equivalente sul traverso (luce ${luce} mm)`, qEq, null, "kN/m", "dato OBO non disponibile");
}

/** Montante o pendino a mensola rispetto al fissaggio: tensione da momento M (kNm) e sforzo normale N (kN). */
export function verificaFlessione(nome: string, s: Statica | null, M: number, N: number): Verifica {
  if (!s) return verifica(nome, "tensione per flessione e sforzo normale", 0, null, "N/mm²", "valori statici non disponibili");
  const sigma = (Math.abs(M) * 1e6) / (s.Wy * 1000) + (s.A ? (Math.abs(N) * 1000) / (s.A * 100) : 0);
  return verifica(nome, "tensione per flessione e sforzo normale", sigma, SIGMA_AMM, "N/mm²", `calcolo con Wy${s.A ? " e A" : ""} (σ amm ${SIGMA_AMM} N/mm²)`);
}

/** Carico critico euleriano (kN) di un montante compresso, lunghezza libera di inflessione l0 (mm). */
export function caricoCritico(s: Statica | null, l0: number): number | null {
  if (!s) return null;
  const I = Math.min(s.Iy, s.Iz ?? s.Iy) * 1e4;
  return (Math.PI ** 2 * E_ACCIAIO * I) / (l0 * l0) / 1000;
}
