/**
 * Lettura dei valori dal display dello strumento nella foto della misura.
 * Usa il riconoscimento del testo del browser (TextDetector, disponibile su Chrome per Android e ChromeOS);
 * dove non c'è restituisce null e il valore si scrive a mano guardando la foto.
 */
export interface ValoreLetto { valore: number; testo: string }

/** Numeri con eventuale unità (Ω, ohm, mΩ, kΩ) convertiti in ohm; prima quelli con l'unità. */
export function numeriDaTesto(testo: string): ValoreLetto[] {
  const out: (ValoreLetto & { conUnita: boolean })[] = [];
  const re = /(\d{1,4}(?:[.,]\d{1,4})?)\s*(m|k|M)?\s*(Ω|ohm|Ohm|OHM|W(?=\b))?/g;
  for (const m of testo.matchAll(re)) {
    const n = Number(m[1]!.replace(",", ".")); if (!Number.isFinite(n)) continue;
    const pref = m[2], unita = !!m[3];
    const k = pref === "m" ? 1e-3 : pref === "k" ? 1e3 : pref === "M" ? 1e6 : 1;
    if (!unita && pref) continue; // "5 m" (metri) senza ohm: non è una misura
    const v = Math.round(n * k * 10000) / 10000;
    if (!out.some((x) => x.valore === v)) out.push({ valore: v, testo: m[0].trim(), conUnita: unita });
  }
  return out.sort((a, b) => Number(b.conUnita) - Number(a.conUnita)).slice(0, 6).map(({ valore, testo: t }) => ({ valore, testo: t }));
}

type Rilevatore = { detect: (im: ImageBitmapSource) => Promise<{ rawValue: string }[]> };
export const letturaDisponibile = () => typeof window !== "undefined" && "TextDetector" in window;

export async function leggiDisplay(foto: Blob): Promise<ValoreLetto[] | null> {
  if (!letturaDisponibile()) return null;
  try {
    const Td = (window as unknown as { TextDetector: new () => Rilevatore }).TextDetector;
    const bmp = await createImageBitmap(foto);
    const righe = await new Td().detect(bmp); bmp.close();
    return numeriDaTesto(righe.map((r) => r.rawValue).join(" \n "));
  } catch { return null; }
}
