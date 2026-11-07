/**
 * Numero medio di eventi pericolosi dovuti a fulmini sulla struttura (CEI EN IEC 62305-2).
 * ND = NG · AD · CD · 10⁻⁶
 * @param densita densità di fulminazione al suolo NG (fulmini/km²·anno)
 * @param AD area di raccolta (m²)
 * @param CD fattore di posizione
 * @returns eventi/anno
 */
export function eventiPericolosi(densita: number, AD: number, CD: number): number {
  if (![densita, AD, CD].every((v) => Number.isFinite(v) && v >= 0)) {
    throw new Error("Valori non validi: densità, AD e CD devono essere numeri ≥ 0");
  }
  return densita * AD * CD * 1e-6;
}
