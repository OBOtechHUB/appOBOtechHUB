/** Quantità da ordinare: intera, arrotondata per eccesso al multiplo della confezione METEL (1 se non indicata). */
export function quantitaOrdine(q: number, confezione?: number | null): number {
  if (!(q > 0)) return 0;
  const c = confezione && confezione > 1 ? Math.round(confezione) : 1;
  return Math.ceil(q / c - 1e-9) * c;
}
