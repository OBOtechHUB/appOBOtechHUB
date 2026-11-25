/**
 * Serve la protezione contro le sovratensioni transitorie di origine atmosferica? (CEI 64-8/4:2024-07, Sezione 443)
 * - Obbligatoria quando le conseguenze riguardano vita umana, servizi pubblici o patrimonio culturale, attività
 *   commerciali o industriali, molte persone (443.4).
 * - Negli altri casi: livello di rischio calcolato CRL = fenv / (LP · Ng) (443.5); serve se CRL < 1000.
 *   fenv = 85 (rurale e suburbano) o 850 (urbano), con F = 1 (Tab. 443.1).
 *   LP = 2·LPAL + LPCL + 0,4·LPAH + 0,2·LPCH (km), tratti limitati in totale a 1 km o alla distanza dal primo SPD
 *   della rete; se le lunghezze non sono note, LPAL completa la lunghezza fino a 1 km.
 * - Senza valutazione del rischio la protezione va comunque prevista.
 * Tensioni di tenuta a impulso Uw per categoria (230/400 V): IV 6 kV, III 4 kV, II 2,5 kV, I 1,5 kV (Tab. 443.2).
 */
export type Ambiente = "rurale" | "urbano";
export interface Tratti { aereaBt: number; cavoBt: number; aereaAt: number; cavoAt: number }

export function fattoreAmbiente(a: Ambiente): number { return a === "urbano" ? 850 : 85; }

/** Tratti limitati in totale a `limite` km (1 km o distanza dal primo SPD della rete); se ignoti completa con linea aerea BT. */
export function trattiValutati(t: Partial<Tratti>, limite = 1, ignoti = false): Tratti {
  const lim = Math.max(0, Math.min(1, limite));
  let resto = lim; const out: Tratti = { aereaBt: 0, cavoBt: 0, aereaAt: 0, cavoAt: 0 };
  for (const k of ["aereaBt", "cavoBt", "aereaAt", "cavoAt"] as (keyof Tratti)[]) { const v = Math.max(0, t[k] ?? 0); out[k] = Math.min(v, resto); resto -= out[k]; }
  if (ignoti && resto > 0) out.aereaBt += resto;
  return out;
}
export function lunghezzaEquivalente(t: Tratti): number { return 2 * t.aereaBt + t.cavoBt + 0.4 * t.aereaAt + 0.2 * t.cavoAt; }

export interface EsitoCrl { obbligatoria: boolean; crl: number | null; lp: number; fenv: number; serve: boolean; motivo: string }
export function valutaCrl(p: { conseguenzeGravi: boolean; ambiente: Ambiente; ng: number; tratti: Partial<Tratti>; limite?: number; ignoti?: boolean }): EsitoCrl {
  const fenv = fattoreAmbiente(p.ambiente), t = trattiValutati(p.tratti, p.limite ?? 1, p.ignoti ?? false), lp = lunghezzaEquivalente(t);
  if (p.conseguenzeGravi) return { obbligatoria: true, crl: null, lp, fenv, serve: true, motivo: "Conseguenze su vita umana, servizi pubblici, attività commerciali/industriali o molte persone: protezione obbligatoria (443.4)." };
  if (!(p.ng > 0)) return { obbligatoria: false, crl: null, lp, fenv, serve: true, motivo: "Densità di fulmini Ng non indicata: senza valutazione del rischio la protezione va prevista (443.4)." };
  if (!(lp > 0)) return { obbligatoria: false, crl: Infinity, lp, fenv, serve: false, motivo: "Nessun tratto di linea esposto: CRL molto alto, protezione non richiesta (443.5)." };
  const crl = fenv / (lp * p.ng);
  return { obbligatoria: false, crl, lp, fenv, serve: crl < 1000, motivo: crl < 1000 ? `CRL = ${Math.round(crl)} < 1000: protezione richiesta (443.5).` : `CRL = ${Math.round(crl)} ≥ 1000: protezione non richiesta dalla 64-8 (resta la valutazione CEI EN 62305-2 se c'è un LPS).` };
}
