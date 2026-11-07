/**
 * Area di raccolta AD di una struttura isolata rettangolare (CEI EN IEC 62305-2).
 * AD = L·W + 2·(3·H)·(L+W) + π·(3·H)²
 * @returns area in m²
 */
export function areaRaccolta(L: number, W: number, H: number): number {
  if (![L, W, H].every((v) => Number.isFinite(v) && v >= 0)) {
    throw new Error("Dimensioni non valide: L, W e H devono essere numeri ≥ 0");
  }
  const h3 = 3 * H;
  return L * W + 2 * h3 * (L + W) + Math.PI * h3 * h3;
}
