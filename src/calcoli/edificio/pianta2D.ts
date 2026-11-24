/**
 * Pianta 2D dell'edificio: quote dei corpi, blocchi sul tetto puntati in pianta con altezza manuale,
 * altezze lette dai prospetti (immagine o PDF calibrati). Logica pura.
 */
import type { Corpo, Punto2 } from "./tipi";

export const sommita = (c: Pick<Corpo, "quotaBase" | "altezzaGronda" | "tipoTetto" | "altezzaColmo">) =>
  (c.quotaBase ?? 0) + (c.tipoTetto === "falde" ? Math.max(c.altezzaGronda, c.altezzaColmo ?? 0) : c.altezzaGronda);
export const quotaGronda = (c: Pick<Corpo, "quotaBase" | "altezzaGronda">) => (c.quotaBase ?? 0) + c.altezzaGronda;

export function puntoInPoligono(p: Punto2, poli: Punto2[]): boolean {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i]!, [xj, yj] = poli[j]!;
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export function centroide(poli: Punto2[]): Punto2 {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i]!, [xj, yj] = poli[j]!, f = xj * yi - xi * yj;
    a += f; cx += (xj + xi) * f; cy += (yj + yi) * f;
  }
  if (Math.abs(a) < 1e-9) { const n = poli.length || 1; return [poli.reduce((s, p) => s + p[0], 0) / n, poli.reduce((s, p) => s + p[1], 0) / n]; }
  return [cx / (3 * a), cy / (3 * a)];
}

/** Corpo più alto che contiene il punto (copertura su cui appoggia un blocco), escluso `escludi`. */
export function corpoSotto(p: Punto2, corpi: Corpo[], escludi?: string): Corpo | null {
  let best: Corpo | null = null;
  for (const c of corpi) if (c.id !== escludi && !c.mesh && puntoInPoligono(p, c.impronta) && (!best || quotaGronda(c) > quotaGronda(best))) best = c;
  return best;
}

/** Impronta del blocco: due punti = rettangolo con i lati paralleli agli assi; tre o più = poligono. */
export function improntaDaPunti(punti: Punto2[]): Punto2[] | null {
  if (punti.length === 2) {
    const [[x0, y0], [x1, y1]] = punti as [Punto2, Punto2];
    if (Math.abs(x1 - x0) < 0.05 || Math.abs(y1 - y0) < 0.05) return null;
    const a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(y0, y1), d = Math.max(y0, y1);
    return [[a, c], [b, c], [b, d], [a, d]];
  }
  return punti.length >= 3 ? punti.map((p) => [p[0], p[1]] as Punto2) : null;
}

/** Blocco sul tetto (volume tecnico, UTA, torrino…): base sulla copertura sotto al suo centro, altezza manuale. */
export function bloccoDaPunti(punti: Punto2[], altezza: number, corpi: Corpo[], opz: { id: string; nome?: string; quotaBase?: number | null }): Corpo | null {
  const impronta = improntaDaPunti(punti);
  if (!impronta || !(altezza > 0)) return null;
  const sotto = corpoSotto(centroide(impronta), corpi);
  const base = opz.quotaBase ?? (sotto ? quotaGronda(sotto) : 0);
  return { id: opz.id, nome: opz.nome || (sotto ? `Blocco su ${sotto.nome}` : "Blocco"), impronta, quotaBase: Math.round(base * 100) / 100, altezzaGronda: Math.round(altezza * 100) / 100, tipoTetto: "piano", altezzaColmo: Math.round(altezza * 100) / 100 };
}

// ---------- prospetti
export type P = { x: number; y: number };
/** metri per pixel da due punti a distanza nota */
export function scalaDaDuePunti(a: P, b: P, metri: number): number | null {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return d > 0 && metri > 0 ? metri / d : null;
}
/** quota (m) del punto sopra la linea di terra (y dell'immagine cresce verso il basso) */
export function quotaDaProspetto(yTerra: number, yPunto: number, metriPerPx: number): number {
  return Math.round((yTerra - yPunto) * metriPerPx * 100) / 100;
}

/** Nuove quote del corpo da una quota assoluta letta sul prospetto. */
export function applicaQuota(c: Corpo, quota: number, cosa: "gronda" | "colmo" | "base"): Partial<Corpo> {
  const base = c.quotaBase ?? 0;
  if (cosa === "base") return { quotaBase: quota };
  const h = Math.max(0, Math.round((quota - base) * 100) / 100);
  if (cosa === "colmo") return { tipoTetto: "falde", altezzaColmo: Math.max(h, c.altezzaGronda) };
  return c.tipoTetto === "falde" ? { altezzaGronda: Math.min(h, c.altezzaColmo ?? h) } : { altezzaGronda: h, altezzaColmo: h };
}
